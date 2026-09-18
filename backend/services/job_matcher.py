"""
Job Matcher Service — Bidirectional AI Recommendation Engine.

Phase C & Task 0.4: "Jobs For You" Matching Engine:
- Extracts candidate primary resume summary and core skills.
- Encodes candidate profile into 768-dim normalized vector via local SentenceTransformer ("BAAI/bge-base-en-v1.5").
- Vector Retrieval Strategy:
  * Atlas Vector Search (FEATURE_ATLAS_VECTOR_SEARCH = True):
    - Uses Atlas `$vectorSearch` with HNSW graph indexing.
    - Time Complexity: O(log(N_jobs) * D) where N_jobs is corpus size and D = 768.
    - Network / IO: Fetches only top candidate documents, minimizing transport and memory overhead.
  * In-Memory Scan Fallback (FEATURE_ATLAS_VECTOR_SEARCH = False or local Mongo fallback):
    - Brute-force linear scan over open jobs in MongoDB.
    - Time Complexity: O(N_jobs * D).
- Applies candidate application history: already-applied jobs are excluded from recommendations.
- Zero OpenAI dependencies; 100% local CPU vector encoding.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import structlog
from bson import ObjectId

from core.feature_flags import FEATURE_ATLAS_VECTOR_SEARCH
from services.embedding_service import embedding_model, EMBEDDING_DIMENSIONS

logger = structlog.get_logger(__name__)


def _calculate_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Computes cosine similarity between two float vectors.
    Since both vectors are L2-normalized upon encoding, cosine similarity equals dot product.
    """
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    return float(dot)


def _calibrate_match_score(raw_cosine: float) -> float:
    """
    Calibrates raw BGE cosine similarity (typically 0.40 - 0.85) into a transparent 
    and motivating ATS match percentage (50% - 98%).
    """
    if raw_cosine <= 0.0:
        return 0.0

    # Linear calibration mapping [0.35, 0.85] -> [50.0, 98.0]
    scaled = 50.0 + ((raw_cosine - 0.35) / 0.50) * 48.0
    return round(min(98.0, max(45.0, scaled)), 1)


async def find_jobs_for_candidate(
    candidate_id: str,
    limit: int = 5,
    db: Any = None,
    resume_repo: Any = None,
) -> Dict[str, Any]:
    """
    Bidirectional AI matcher finding top recommended open jobs for a candidate.

    Algorithmic Complexity:
    - With Atlas Vector Search ($vectorSearch): O(log(N_jobs) * D) ANN retrieval via HNSW graph.
    - Fallback: O(N_jobs * D) full linear in-memory scan.

    Args:
        candidate_id: MongoDB user ID of candidate.
        limit: Max recommended jobs to return (default 5).
        db: Motor async database client.
        resume_repo: ResumeRepository instance.

    Returns:
        Dict: {
            "recommended_jobs": [...],
            "total_open_jobs": int,
            "has_resume": bool,
            "resume_id": str | None,
            "processing_time_ms": int
        }
    """
    t0 = time.perf_counter()

    if db is None:
        raise ValueError("Database instance must be provided to find_jobs_for_candidate.")

    # 1. Retrieve candidate's primary or latest parsed resume
    target_resume = None
    if resume_repo:
        try:
            target_resume = await resume_repo.get_primary_by_user(str(candidate_id))
            if not target_resume or not target_resume.parsed_data:
                resumes, _ = await resume_repo.get_by_user(str(candidate_id), limit=1)
                target_resume = resumes[0] if resumes else None
        except Exception as e:
            logger.warning("Failed to fetch resume via repo", error=str(e))

    # Fallback direct MongoDB lookup if repo unavailable
    if not target_resume:
        doc = await db.resumes.find_one(
            {"user_id": str(candidate_id), "status": "parsed"},
            sort=[("is_primary", -1), ("created_at", -1)],
        )
        if doc and doc.get("parsed_data"):
            from models.resume_model import ResumeModel
            try:
                target_resume = ResumeModel(**doc)
            except Exception:
                target_resume = doc

    if not target_resume:
        logger.info("No parsed resume found for candidate", candidate_id=candidate_id)
        return {
            "recommended_jobs": [],
            "total_open_jobs": await db.jobs.count_documents({"status": "open"}),
            "has_resume": False,
            "resume_id": None,
            "processing_time_ms": int((time.perf_counter() - t0) * 1000),
            "message": "Upload your resume to activate AI-tailored job recommendations.",
        }

    # Extract parsed fields
    parsed = getattr(target_resume, "parsed_data", None)
    if hasattr(parsed, "model_dump"):
        parsed_dict = parsed.model_dump()
    elif isinstance(parsed, dict):
        parsed_dict = parsed
    else:
        parsed_dict = {}

    summary_text = parsed_dict.get("summary") or ""
    skills = parsed_dict.get("technical_skills") or parsed_dict.get("skills") or []
    skills_text = ", ".join(skills[:25])
    raw_text = parsed_dict.get("raw_text") or getattr(target_resume, "raw_text", "") or ""

    # Synthesize candidate profile representation for embedding
    candidate_profile_text = f"Skills: {skills_text}. Professional Summary: {summary_text}. Highlights: {raw_text[:1200]}"
    if not candidate_profile_text.strip():
        candidate_profile_text = raw_text[:1500]

    # 2. Encode candidate profile into 768-dim normalized vector via local SentenceTransformer
    try:
        vectors = embedding_model.encode([candidate_profile_text])
        candidate_vec = vectors[0] if vectors else [0.0] * EMBEDDING_DIMENSIONS
    except Exception as e:
        logger.error("Failed to generate candidate embedding vector", error=str(e))
        candidate_vec = [0.0] * EMBEDDING_DIMENSIONS

    # 3. Retrieve candidate's applied jobs to exclude them from recommendation slots
    applied_job_ids = set()
    try:
        app_cursor = db.applications.find({"candidate_id": str(candidate_id)}, {"job_id": 1})
        applied_docs = await app_cursor.to_list(length=500)
        for a in applied_docs:
            if a.get("job_id"):
                applied_job_ids.add(str(a["job_id"]))
    except Exception as e:
        logger.warning("Failed to fetch candidate applied jobs", error=str(e))

    candidate_skills_set = {s.lower() for s in skills}
    ranked_jobs: List[Dict[str, Any]] = []
    vector_search_used = False

    # 4. Strategy A: MongoDB Atlas $vectorSearch (if enabled)
    if FEATURE_ATLAS_VECTOR_SEARCH:
        try:
            num_candidates = max(200, 20 * limit)
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "jd_vector_index",
                        "path": "jd_embedding_bge",
                        "queryVector": candidate_vec,
                        "numCandidates": num_candidates,
                        "limit": max(20, limit * 3),
                        "filter": {
                            "status": {"$eq": "open"}
                        },
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "title": 1,
                        "company_name": 1,
                        "location": 1,
                        "work_mode": 1,
                        "salary_range": 1,
                        "required_skills": 1,
                        "min_years": 1,
                        "department": 1,
                        "created_at": 1,
                        "vector_score": {"$meta": "vectorSearchScore"},
                    }
                },
            ]
            cursor = db.jobs.aggregate(pipeline)
            vector_docs = await cursor.to_list(length=max(20, limit * 3))

            for doc in vector_docs:
                job_id_str = str(doc["_id"])
                raw_similarity = float(doc.get("vector_score", 0.5))
                match_score = _calibrate_match_score(raw_similarity)
                req_skills = doc.get("required_skills") or []
                matched_skills = [s for s in req_skills if s.lower() in candidate_skills_set]

                ranked_jobs.append({
                    "id": job_id_str,
                    "title": doc.get("title", "Software Engineer"),
                    "company_name": doc.get("company_name", "Technology Corp"),
                    "location": doc.get("location", "Remote"),
                    "work_mode": doc.get("work_mode", "Remote"),
                    "salary_range": doc.get("salary_range"),
                    "department": doc.get("department"),
                    "min_years": float(doc.get("min_years", 0.0)),
                    "required_skills": req_skills[:6],
                    "matched_skills": matched_skills[:4],
                    "match_score": match_score,
                    "raw_similarity": round(raw_similarity, 4),
                    "is_applied": job_id_str in applied_job_ids,
                    "created_at": doc.get("created_at"),
                })

            vector_search_used = True
            logger.info(
                "Atlas vector search executed successfully",
                candidate_id=candidate_id,
                retrieved_count=len(ranked_jobs),
            )
        except Exception as vs_err:
            logger.warning(
                "Atlas vector search failed or unsupported on this deployment; falling back to in-memory scan",
                error=str(vs_err),
            )
            ranked_jobs = []
            vector_search_used = False

    # 5. Strategy B: In-Memory Cosine Fallback (O(N_jobs * D))
    total_open_count = 0
    if not vector_search_used:
        cursor = db.jobs.find(
            {"status": "open"},
            {
                "_id": 1,
                "title": 1,
                "company_name": 1,
                "location": 1,
                "work_mode": 1,
                "salary_range": 1,
                "required_skills": 1,
                "min_years": 1,
                "jd_text_raw": 1,
                "department": 1,
                "jd_embedding": 1,
                "jd_embedding_bge": 1,
                "created_at": 1,
            },
        )
        open_jobs = await cursor.to_list(length=500)
        total_open_count = len(open_jobs)

        if not open_jobs:
            return {
                "recommended_jobs": [],
                "total_open_jobs": 0,
                "has_resume": True,
                "resume_id": str(getattr(target_resume, "id", None) or getattr(target_resume, "_id", "")),
                "processing_time_ms": int((time.perf_counter() - t0) * 1000),
                "message": "No open jobs currently available in the marketplace.",
            }

        for job in open_jobs:
            job_id_str = str(job["_id"])
            jd_embedding = job.get("jd_embedding_bge") or job.get("jd_embedding") or []

            # Calculate vector similarity
            if jd_embedding and len(jd_embedding) == EMBEDDING_DIMENSIONS:
                raw_cosine = _calculate_cosine_similarity(candidate_vec, jd_embedding)
            else:
                raw_cosine = 0.50

            req_skills = job.get("required_skills") or []
            matched_skills = [s for s in req_skills if s.lower() in candidate_skills_set]
            match_score = _calibrate_match_score(raw_cosine)

            ranked_jobs.append({
                "id": job_id_str,
                "title": job.get("title", "Software Engineer"),
                "company_name": job.get("company_name", "Technology Corp"),
                "location": job.get("location", "Remote"),
                "work_mode": job.get("work_mode", "Remote"),
                "salary_range": job.get("salary_range"),
                "department": job.get("department"),
                "min_years": float(job.get("min_years", 0.0)),
                "required_skills": req_skills[:6],
                "matched_skills": matched_skills[:4],
                "match_score": match_score,
                "raw_similarity": round(raw_cosine, 4),
                "is_applied": job_id_str in applied_job_ids,
                "created_at": job.get("created_at"),
            })
    else:
        try:
            total_open_count = await db.jobs.count_documents({"status": "open"})
        except Exception:
            total_open_count = len(ranked_jobs)

    # 6. Exclude applied jobs from recommendation slots
    unapplied_jobs = [j for j in ranked_jobs if not j["is_applied"]]
    # Fallback to all ranked if user has applied to everything
    candidate_matches = unapplied_jobs if unapplied_jobs else ranked_jobs
    candidate_matches.sort(key=lambda j: j["match_score"], reverse=True)
    top_matches = candidate_matches[:limit]

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "Jobs for you recommendation computed",
        candidate_id=candidate_id,
        matched_count=len(top_matches),
        vector_search_used=vector_search_used,
        elapsed_ms=elapsed_ms,
    )

    return {
        "recommended_jobs": top_matches,
        "total_open_jobs": total_open_count,
        "has_resume": True,
        "resume_id": str(getattr(target_resume, "id", None) or getattr(target_resume, "_id", "")),
        "processing_time_ms": elapsed_ms,
    }


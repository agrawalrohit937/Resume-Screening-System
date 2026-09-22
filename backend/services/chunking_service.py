"""
Chunking & Max-Sim Late Interaction Service.

Phase 1.2:
- Chunks resumes into semantic units (experiences, projects, skills, education, summary, certifications).
- Chunks job descriptions into individual requirement statements.
- Computes Max-Sim late interaction score via batched NumPy matrix multiplication.
- Provides free evidence attribution by capturing the argmax resume chunk per requirement.
- Time Complexity: O(N_req * N_chunk * D). With N_req <= 30, N_chunk <= 40, D = 1024 (~1.2M FLOPs).
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


def _sha256(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def chunk_resume(parsed_resume: Dict[str, Any], raw_text: str = "") -> List[Dict[str, Any]]:
    """
    Deconstructs a parsed resume into distinct semantic units.
    Each chunk represents a coherent entity (experience role, project, education, skills).
    """
    chunks: List[Dict[str, Any]] = []
    chunk_index = 0

    # 1. Summary
    summary = str(parsed_resume.get("summary") or "").strip()
    if summary:
        chunks.append({
            "chunk_type": "summary",
            "chunk_index": chunk_index,
            "title": "Professional Summary",
            "text": summary,
            "text_hash": _sha256(summary),
        })
        chunk_index += 1

    # 2. Technical Skills Block
    skills = parsed_resume.get("skills") or parsed_resume.get("technical_skills") or []
    if skills:
        skills_str = ", ".join(str(s).strip() for s in skills if s)
        text = f"Core Technical & Professional Skills: {skills_str}"
        chunks.append({
            "chunk_type": "skills",
            "chunk_index": chunk_index,
            "title": "Skills Overview",
            "text": text,
            "text_hash": _sha256(text),
        })
        chunk_index += 1

    # 3. Work Experience entries
    experiences = parsed_resume.get("experience") or parsed_resume.get("work_experience") or []
    for exp in experiences:
        if not isinstance(exp, dict):
            continue
        role = str(exp.get("role") or exp.get("title") or exp.get("job_title") or "Professional Role").strip()
        company = str(exp.get("company") or exp.get("organization") or "").strip()
        desc = str(exp.get("description") or exp.get("responsibilities") or "").strip()
        highlights = exp.get("highlights") or exp.get("achievements") or []
        if isinstance(highlights, list):
            hl_str = " ".join(str(h).strip() for h in highlights if h)
        else:
            hl_str = str(highlights or "")

        full_exp = f"{role} at {company}. {desc} {hl_str}".strip()
        if full_exp:
            chunks.append({
                "chunk_type": "experience",
                "chunk_index": chunk_index,
                "title": f"{role} ({company})" if company else role,
                "text": full_exp,
                "text_hash": _sha256(full_exp),
                "metadata": {
                    "role": role,
                    "company": company,
                    "start_date": exp.get("start_date"),
                    "end_date": exp.get("end_date"),
                },
            })
            chunk_index += 1

    # 4. Project entries
    projects = parsed_resume.get("projects") or []
    for proj in projects:
        if isinstance(proj, dict):
            name = str(proj.get("name") or proj.get("title") or "Technical Project").strip()
            desc = str(proj.get("description") or "").strip()
            tech = ", ".join(proj.get("technologies", [])) if isinstance(proj.get("technologies"), list) else str(proj.get("technologies") or "")
            text = f"Project {name}: {desc} Technologies: {tech}".strip()
        else:
            name = "Project"
            text = str(proj).strip()

        if text:
            chunks.append({
                "chunk_type": "project",
                "chunk_index": chunk_index,
                "title": name,
                "text": text,
                "text_hash": _sha256(text),
            })
            chunk_index += 1

    # 5. Education entries
    education_entries = parsed_resume.get("education") or []
    for edu in education_entries:
        if isinstance(edu, dict):
            deg = str(edu.get("degree") or "").strip()
            inst = str(edu.get("institution") or edu.get("school") or edu.get("college") or "").strip()
            field = str(edu.get("field") or edu.get("major") or "").strip()
            text = f"Degree: {deg} in {field} from {inst}".strip()
        else:
            text = str(edu).strip()

        if text:
            chunks.append({
                "chunk_type": "education",
                "chunk_index": chunk_index,
                "title": "Education",
                "text": text,
                "text_hash": _sha256(text),
            })
            chunk_index += 1

    # 6. Certifications
    certs = parsed_resume.get("certifications") or []
    for cert in certs:
        text = str(cert.get("name") if isinstance(cert, dict) else cert).strip()
        if text:
            chunks.append({
                "chunk_type": "certification",
                "chunk_index": chunk_index,
                "title": "Certification",
                "text": text,
                "text_hash": _sha256(text),
            })
            chunk_index += 1

    # Fallback to paragraph chunks if structured parsing is empty
    if not chunks and raw_text:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw_text) if len(p.strip()) > 30]
        for p in paragraphs[:25]:
            chunks.append({
                "chunk_type": "raw_section",
                "chunk_index": chunk_index,
                "title": "Resume Section",
                "text": p,
                "text_hash": _sha256(p),
            })
            chunk_index += 1

    return chunks


def chunk_jd(
    jd_text: str,
    required_skills: Optional[List[str]] = None,
    criticality_index: Optional[Any] = None,
    skills: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Deconstructs a Job Description into distinct requirement statements.
    Each requirement is annotated with its criticality weight.
    """
    reqs: List[Dict[str, Any]] = []
    req_index = 0
    seen_texts = set()

    # 1. Explicit core required skills
    target_skills = required_skills or skills or []
    for skill in target_skills:
        s_clean = skill.strip()
        if s_clean and s_clean.lower() not in seen_texts:
            seen_texts.add(s_clean.lower())
            crit = 3.0
            if criticality_index:
                crit = criticality_index.get_criticality(s_clean)
            reqs.append({
                "req_type": "skill",
                "req_index": req_index,
                "title": f"Skill: {s_clean}",
                "text": f"Proficiency and hands-on experience in {s_clean}.",
                "criticality": crit,
            })
            req_index += 1

    # 2. Extract bullet points and requirement statements from text
    lines = [line.strip() for line in (jd_text or "").split("\n") if line.strip()]
    for line in lines:
        cleaned_line = re.sub(r"^[-*•\d\.]+\s*", "", line).strip()
        if len(cleaned_line) < 25 or len(cleaned_line) > 300:
            continue
        lower_line = cleaned_line.lower()
        if lower_line in seen_texts:
            continue
        seen_texts.add(lower_line)

        crit = 2.0
        if criticality_index:
            # Check if line contains soft or hard language
            if re.search(r"\b(preferred|nice to have|plus|bonus|desirable)\b", lower_line):
                crit = 1.0
            elif re.search(r"\b(required|must have|mandatory|essential|minimum)\b", lower_line):
                crit = 3.0

        reqs.append({
            "req_type": "statement",
            "req_index": req_index,
            "title": "Requirement",
            "text": cleaned_line,
            "criticality": crit,
        })
        req_index += 1

    if not reqs and jd_text:
        reqs.append({
            "req_type": "full_jd",
            "req_index": 0,
            "title": "Job Overview",
            "text": jd_text[:1000],
            "criticality": 2.0,
        })

    return reqs


def compute_max_sim_vector_score(
    req_vectors: np.ndarray,
    chunk_vectors: np.ndarray,
    weights: np.ndarray,
    req_meta: Optional[List[Dict[str, Any]]] = None,
    chunk_meta: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Max-Sim Late Interaction via Batched NumPy Matrix Multiplication.

    Args:
        req_vectors: np.ndarray of shape (N_req, D), normalized.
        chunk_vectors: np.ndarray of shape (N_chunk, D), normalized.
        weights: np.ndarray of shape (N_req,), containing requirement weights.
        req_meta: Metadata list corresponding to requirements.
        chunk_meta: Metadata list corresponding to resume chunks.

    Returns:
        (vector_score, attribution_evidence)
        where vector_score is float (0.0 to 100.0)
        and attribution_evidence contains argmax chunk per requirement.
    """
    if req_vectors.size == 0 or chunk_vectors.size == 0:
        return 50.0, []

    # S = R * C^T  -> shape (N_req, N_chunk)
    similarity_matrix = np.matmul(req_vectors, chunk_vectors.T)

    # Max-Sim: argmax along chunks axis
    best_chunk_indices = np.argmax(similarity_matrix, axis=1)
    max_sim_values = np.max(similarity_matrix, axis=1)

    # Convert cosine [-1.0, 1.0] to percentage score [0.0, 100.0]
    # Linear scale [MAXSIM_FLOOR, MAXSIM_CEIL] -> [40.0, 98.0]
    import os
    maxsim_floor = float(os.getenv("MAXSIM_FLOOR", "0.30"))
    maxsim_ceil = float(os.getenv("MAXSIM_CEIL", "0.85"))
    span = max(1e-5, maxsim_ceil - maxsim_floor)
    scaled_scores = np.clip(40.0 + ((max_sim_values - maxsim_floor) / span) * 58.0, 30.0, 99.0)

    # Weighted mean by requirement criticality
    total_weights = np.sum(weights)
    if total_weights > 0:
        final_vector_score = float(np.sum(scaled_scores * weights) / total_weights)
    else:
        final_vector_score = float(np.mean(scaled_scores))

    # Evidence attribution
    evidence: List[Dict[str, Any]] = []
    for i, (best_idx, sim_val, score_val) in enumerate(zip(best_chunk_indices, max_sim_values, scaled_scores)):
        rm = req_meta[i] if req_meta and i < len(req_meta) else {}
        cm = chunk_meta[best_idx] if chunk_meta and best_idx < len(chunk_meta) else {}
        evidence.append({
            "req_index": i,
            "req_text": rm.get("text", f"Requirement {i}"),
            "criticality": float(weights[i]) if i < len(weights) else 2.0,
            "best_chunk_index": int(best_idx),
            "best_chunk_type": cm.get("chunk_type", "chunk"),
            "best_chunk_title": cm.get("title", ""),
            "best_chunk_text": cm.get("text", "")[:250],
            "raw_cosine": round(float(sim_val), 4),
            "matched_score": round(float(score_val), 1),
        })

    return round(final_vector_score, 1), evidence

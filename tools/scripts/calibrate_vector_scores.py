"""
Vector Calibration Script (Phase 1.3).
Samples N (>=100) resume-JD pairs from MongoDB (or deterministic smoke test samples),
computes raw BGE cosine for both single-vector and multi-vector Max-Sim paths,
computes p5/p50/p95 percentiles, and outputs recommended calibration parameters to JSON.

Usage:
    python scripts/calibrate_vector_scores.py --samples 100 --output config/vector_calibration.json
"""

import argparse
import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Tuple
import numpy as np
import structlog

# Set up logging
logging_config = structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger(__name__)


SAMPLE_SYNTHETIC_RESUMES = [
    "Senior Python Developer with 6 years experience in FastAPI, PostgreSQL, Redis, Docker, and Kubernetes.",
    "Frontend React Engineer proficient in TypeScript, Next.js, Redux Toolkit, TailwindCSS, and Jest testing.",
    "Fullstack Engineer with Node.js, Express, React, MongoDB, GraphQL, and AWS Lambda serverless experience.",
    "DevOps and Cloud Infrastructure Engineer with Terraform, AWS, GCP, CI/CD pipelines, Prometheus, and Grafana.",
    "Data Scientist and ML Engineer with PyTorch, Scikit-Learn, Pandas, NLP transformers, and MLflow.",
    "Java Backend Developer with Spring Boot, Microservices, Kafka, MySQL, and Docker containerization.",
    "Mobile Developer with Flutter, Dart, iOS Swift, Android Kotlin, and Firebase authentication.",
    "Entry-level Junior Software Developer with Python, Django, HTML, CSS, JavaScript, and Git fundamentals.",
]

SAMPLE_SYNTHETIC_JDS = [
    "Looking for a Senior Python Developer with 5+ years experience in FastAPI, microservices, and Docker.",
    "Hiring a Frontend Engineer experienced in React, Next.js, modern CSS, and component design systems.",
    "Seeking a Fullstack Developer with Node.js, React, NoSQL databases, and cloud deployment background.",
    "DevOps Engineer needed for AWS cloud automation, Kubernetes cluster management, and CI/CD pipelines.",
    "Machine Learning Engineer required with strong Python, PyTorch, model deployment, and MLOps skills.",
    "Backend Java Developer with 4+ years in Spring Boot, distributed systems, and message queues.",
    "Mobile Application Developer needed to build cross-platform mobile apps using Flutter and Dart.",
    "Junior Software Engineer opening for eager graduates with strong coding fundamentals in Python or Java.",
]


async def fetch_sample_pairs_from_db(n_samples: int = 100) -> List[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """Fetches real resume and job pairs from MongoDB, or falls back to synthetic combinations."""
    pairs: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
    try:
        from config.db import connect_db, get_database, disconnect_db
        await connect_db()
        db = get_database()

        resumes_cursor = db.resumes.aggregate([{"$sample": {"size": min(n_samples, 200)}}])
        resumes = await resumes_cursor.to_list(length=n_samples)

        jobs_cursor = db.jobs.aggregate([{"$sample": {"size": min(n_samples, 200)}}])
        jobs = await jobs_cursor.to_list(length=n_samples)

        if resumes and jobs:
            for i in range(n_samples):
                r = resumes[i % len(resumes)]
                j = jobs[i % len(jobs)]
                pairs.append((r, j))
        await disconnect_db()
    except Exception as e:
        logger.info("Could not fetch from MongoDB, using synthetic candidate-job pool for calibration", error=str(e))

    # Fill remaining with combinations of sample data if DB has insufficient records
    idx = 0
    while len(pairs) < n_samples:
        r_text = SAMPLE_SYNTHETIC_RESUMES[idx % len(SAMPLE_SYNTHETIC_RESUMES)]
        j_text = SAMPLE_SYNTHETIC_JDS[(idx * 3 + 1) % len(SAMPLE_SYNTHETIC_JDS)]
        pairs.append((
            {"raw_text": r_text, "skills": ["Python", "FastAPI", "React", "Docker"]},
            {"text": j_text, "requirements": [j_text]}
        ))
        idx += 1

    return pairs[:n_samples]


def run_calibration(pairs: List[Tuple[Dict[str, Any], Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Computes single-vector cosine and multi-vector Max-Sim cosine over pairs,
    deriving p5, p50, and p95 calibration bounds.
    """
    from services.embedding_service import embedding_model
    from services.chunking_service import chunk_resume, chunk_jd
    from services.scoring_engine import build_smart_embedding_text

    single_cosines: List[float] = []
    maxsim_cosines: List[float] = []

    for r_doc, j_doc in pairs:
        raw_r_text = r_doc.get("raw_text") or str(r_doc)
        smart_r_text = build_smart_embedding_text(r_doc if isinstance(r_doc, dict) else None, raw_r_text)
        j_text = j_doc.get("text") or j_doc.get("description") or str(j_doc)

        # 1. Single-Vector Raw Cosine
        vecs = embedding_model.encode([smart_r_text[:3000], j_text[:3000]])
        v1 = np.array(vecs[0], dtype=np.float32)
        v2 = np.array(vecs[1], dtype=np.float32)
        denom = float(np.linalg.norm(v1) * np.linalg.norm(v2)) or 1.0
        single_cos = float(v1 @ v2) / denom
        single_cosines.append(single_cos)

        # 2. Multi-Vector Max-Sim Raw Cosine
        try:
            chunks = chunk_resume(r_doc if isinstance(r_doc, dict) else {}, raw_text=raw_r_text)
            reqs = chunk_jd(j_text)
            if chunks and reqs:
                c_texts = [c["text"] for c in chunks]
                r_texts = [rq["text"] for rq in reqs]
                c_vecs = np.array(embedding_model.encode(c_texts), dtype=np.float32)
                r_vecs = np.array(embedding_model.encode(r_texts), dtype=np.float32)

                c_norms = np.linalg.norm(c_vecs, axis=1, keepdims=True)
                c_norms[c_norms == 0] = 1.0
                c_vecs = c_vecs / c_norms

                r_norms = np.linalg.norm(r_vecs, axis=1, keepdims=True)
                r_norms[r_norms == 0] = 1.0
                r_vecs = r_vecs / r_norms

                sim_mat = np.matmul(r_vecs, c_vecs.T)
                max_sims = np.max(sim_mat, axis=1)
                weights = np.array([float(rq.get("criticality", 2.0)) for rq in reqs], dtype=np.float32)
                weighted_maxsim = float(np.sum(max_sims * weights) / max(1e-5, np.sum(weights)))
                maxsim_cosines.append(weighted_maxsim)
            else:
                maxsim_cosines.append(single_cos)
        except Exception:
            maxsim_cosines.append(single_cos)

    single_arr = np.array(single_cosines)
    maxsim_arr = np.array(maxsim_cosines)

    single_p5, single_p50, single_p95 = np.percentile(single_arr, [5, 50, 95])
    maxsim_p5, maxsim_p50, maxsim_p95 = np.percentile(maxsim_arr, [5, 50, 95])

    results = {
        "sample_size": len(pairs),
        "single_vector": {
            "p5": round(float(single_p5), 4),
            "p50": round(float(single_p50), 4),
            "p95": round(float(single_p95), 4),
            "recommended_floor": round(float(max(0.15, single_p5)), 2),
            "recommended_ceil": round(float(min(0.95, single_p95)), 2),
        },
        "max_sim_multi_vector": {
            "p5": round(float(maxsim_p5), 4),
            "p50": round(float(maxsim_p50), 4),
            "p95": round(float(maxsim_p95), 4),
            "recommended_floor": round(float(max(0.15, maxsim_p5)), 2),
            "recommended_ceil": round(float(min(0.95, maxsim_p95)), 2),
        },
        "recommended_env_vars": {
            "VEC_SIM_FLOOR": str(round(float(max(0.15, single_p5)), 2)),
            "VEC_SIM_CEIL": str(round(float(min(0.95, single_p95)), 2)),
            "MAXSIM_FLOOR": str(round(float(max(0.15, maxsim_p5)), 2)),
            "MAXSIM_CEIL": str(round(float(min(0.95, maxsim_p95)), 2)),
        }
    }
    return results


async def main_async():
    parser = argparse.ArgumentParser(description="Calibrate BGE vector scoring bounds.")
    parser.add_argument("--samples", type=int, default=100, help="Number of sample pairs to evaluate (>= 100)")
    parser.add_argument("--output", type=str, default="config/vector_calibration.json", help="Output JSON path")
    args = parser.parse_args()

    n = max(100, args.samples)
    print(f"Sampling {n} Resume-JD pairs for vector calibration...")
    pairs = await fetch_sample_pairs_from_db(n)
    print(f"Evaluating raw BGE-M3 embeddings on {len(pairs)} pairs...")

    res = run_calibration(pairs)

    print("\n" + "=" * 60)
    print("VECTOR SCORE CALIBRATION RESULTS")
    print("=" * 60)
    print(f"Sample Size: {res['sample_size']}")
    print(f"Single Vector   : p5={res['single_vector']['p5']}, p50={res['single_vector']['p50']}, p95={res['single_vector']['p95']}")
    print(f"Recommended Single: VEC_SIM_FLOOR={res['recommended_env_vars']['VEC_SIM_FLOOR']}, VEC_SIM_CEIL={res['recommended_env_vars']['VEC_SIM_CEIL']}")
    print(f"Multi-Vector MaxSim: p5={res['max_sim_multi_vector']['p5']}, p50={res['max_sim_multi_vector']['p50']}, p95={res['max_sim_multi_vector']['p95']}")
    print(f"Recommended MaxSim: MAXSIM_FLOOR={res['recommended_env_vars']['MAXSIM_FLOOR']}, MAXSIM_CEIL={res['recommended_env_vars']['MAXSIM_CEIL']}")
    print("=" * 60)

    out_dir = os.path.dirname(args.output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)
    print(f"\nCalibration configuration saved to: {args.output}\n")


if __name__ == "__main__":
    asyncio.run(main_async())

"""
Semantic Calibration Script
---------------------------
Samples stored resumes, computes pairwise BGE embedding cosine similarities,
and builds an empirical percentile distribution saved to `data/semantic_calibration.json`.
This allows `_calibrate_cosine` to use exact percentile lookup (O(log N))
rather than a fixed linear min-max range.

Usage:
  python scripts/calibrate_semantic.py --max-samples 500
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import List

# Add parent directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import structlog

logger = structlog.get_logger(__name__)

OUTPUT_FILE = Path(__file__).resolve().parent.parent / "data" / "semantic_calibration.json"


async def main():
    parser = argparse.ArgumentParser(description="Calibrate BGE cosine similarity distribution")
    parser.add_argument("--max-samples", type=int, default=500, help="Maximum resumes to sample")
    args = parser.parse_args()

    print(f"[*] Starting semantic calibration (max_samples={args.max_samples})...")

    # 1. Fetch resumes from MongoDB or fallback
    texts: List[str] = []
    try:
        from core.config import settings
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=2000)
        db = client[settings.MONGO_DB_NAME]
        cursor = db["resumes"].find({"status": "parsed"}, {"parsed_data.raw_text": 1}).limit(args.max_samples)
        async for doc in cursor:
            raw = (doc.get("parsed_data") or {}).get("raw_text")
            if raw and len(raw.strip()) > 100:
                texts.append(raw.strip()[:2000])
        print(f"[+] Loaded {len(texts)} resumes from MongoDB.")
    except Exception as e:
        print(f"[-] MongoDB access unavailable or empty: {e}")

    # Fallback to local test samples if database is empty
    if len(texts) < 10:
        print("[*] Generating baseline synthetic corpus for calibration...")
        baseline_samples = [
            "Senior Backend Engineer with Python, FastAPI, Docker, Kubernetes, PostgreSQL microservices.",
            "Frontend Developer skilled in React, Next.js, TypeScript, Tailwind CSS, Redux.",
            "Full Stack Engineer with Node.js, Express, React, MongoDB, AWS cloud deployment.",
            "Data Scientist specializing in Machine Learning, PyTorch, Scikit-learn, Pandas, NLP.",
            "DevOps Engineer with Terraform, Ansible, CI/CD pipelines, Docker, Kubernetes on GCP.",
            "Healthcare Registered Nurse with critical care ICU experience and BLS certification.",
            "Financial Analyst experienced in financial modeling, forecasting, Excel VBA, budgeting.",
            "Civil Engineer specialized in structural design, AutoCAD, project estimation.",
            "Human Resources Talent Acquisition Specialist with recruiting, sourcing, ATS management.",
            "Marketing Manager with SEO, SEM, content strategy, Google Analytics, social media ads."
        ]
        texts = baseline_samples * 10

    # 2. Compute embeddings using BGE model
    from services.embedding_service import embedding_model
    print(f"[*] Encoding {len(texts)} texts with BGE embedding model...")
    embeddings = embedding_model.embed_texts(texts)
    embeddings = np.array(embeddings)

    # 3. Compute pairwise cosine similarities
    print("[*] Computing pairwise cosine similarities...")
    # Normalize vectors
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    normed = embeddings / norms
    sim_matrix = np.dot(normed, normed.T)

    # Extract upper triangle without diagonal
    tri_indices = np.triu_indices(len(texts), k=1)
    similarities = sim_matrix[tri_indices].tolist()

    sorted_sims = sorted([round(float(s), 4) for s in similarities if not np.isnan(s)])
    print(f"[+] Computed {len(sorted_sims)} similarity pairs. Range: [{sorted_sims[0]}, {sorted_sims[-1]}]")

    # Sample down to 1000 sorted checkpoints if huge
    if len(sorted_sims) > 1000:
        step = len(sorted_sims) / 1000.0
        sorted_sims = [sorted_sims[int(i * step)] for i in range(1000)]

    # 4. Save to json
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "model_version": "bge-m3-or-small",
            "sample_count": len(texts),
            "distribution_size": len(sorted_sims),
            "sorted_percentiles": sorted_sims,
        }, f, indent=2)

    print(f"[SUCCESS] Saved semantic calibration distribution to {OUTPUT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())

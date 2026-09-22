"""
Dataset Builder for ATS Evaluation Harness (Phase 2).
Provides:
1. CSV import for manual recruiter annotations (e.g. resumeJD2_pairs.csv).
2. MongoDB export for production candidate evaluations.
3. Synthetic label generator strictly for offline smoke tests (clearly marked synthetic).
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import structlog

from eval.dataset_schema import EvaluationDataset, LabeledPair, RecruiterLabel

logger = structlog.get_logger(__name__)


def load_from_csv(
    csv_path: str | Path,
    limit: int = 0,
    dataset_name: str = "CSV_Imported_Evaluation_Set",
) -> EvaluationDataset:
    """
    Imports annotated pairs from a CSV file (e.g., resumeJD2_pairs.csv).
    Handles columns: resume_text/resume_data, jd_text/jd_data, match_label/label/score.
    """
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Evaluation CSV file not found at: {path}")

    pairs: List[LabeledPair] = []
    with open(path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            if limit > 0 and len(pairs) >= limit:
                break

            r_text = row.get("resume_text") or row.get("resume") or row.get("candidate_text") or ""
            j_text = row.get("jd_text") or row.get("job_description") or row.get("jd") or ""
            
            raw_label = row.get("match_label") or row.get("label") or row.get("recruiter_label") or row.get("score") or "0"
            label_val = RecruiterLabel.from_str(str(raw_label)).value

            r_id = row.get("resume_id") or hashlib.md5(r_text.encode("utf-8")).hexdigest()[:12]
            j_id = row.get("jd_id") or hashlib.md5(j_text.encode("utf-8")).hexdigest()[:12]
            p_id = f"pair_{r_id}_{j_id}_{idx}"

            # Ground truth knockout inference if specified
            is_ko = None
            if "is_knockout" in row:
                is_ko = str(row["is_knockout"]).strip().lower() in ("true", "1", "yes")

            pairs.append(
                LabeledPair(
                    pair_id=p_id,
                    resume_id=r_id,
                    jd_id=j_id,
                    recruiter_label=label_val,
                    resume_data={"raw_text": r_text},
                    jd_data={"text": j_text},
                    is_knockout_expected=is_ko,
                    is_synthetic=False,
                    metadata={"source_file": str(path.name), "row_index": idx},
                )
            )

    logger.info("Evaluation dataset loaded from CSV", count=len(pairs), source=str(path))
    return EvaluationDataset(
        dataset_name=dataset_name,
        description=f"Imported from {path.name}",
        is_synthetic_dataset=False,
        pairs=pairs,
    )


def generate_synthetic_smoke_dataset(
    n_jobs: int = 5,
    candidates_per_job: int = 6,
) -> EvaluationDataset:
    """
    Generates a deterministic synthetic dataset ONLY for smoke testing ranking math.
    Clearly marked as synthetic in all records.
    """
    pairs: List[LabeledPair] = []
    
    archetypes = [
        ("Senior Python Engineer", "Python, FastAPI, Redis, Docker, PostgreSQL. 5+ years experience.", [
            ("Exceptional Lead", "7 years experience. Expert in Python, FastAPI, Redis, Docker, PostgreSQL. Architected microservices.", 3, False),
            ("Solid Mid-Level", "3 years experience. Proficient in Python, FastAPI, PostgreSQL. Built APIs.", 2, False),
            ("Junior with Projects", "Fresh graduate with strong portfolio projects in Python, FastAPI, and Docker on GitHub.", 1, False),
            ("Mismatched Stack", "5 years experience in PHP, Laravel, WordPress, and MySQL.", 0, False),
            ("Under-experienced Knockout", "0 years experience. Only HTML and CSS skills.", 0, True),
        ]),
        ("Frontend React Developer", "React, TypeScript, Redux, TailwindCSS, Jest. 3+ years experience.", [
            ("Senior Frontend Architect", "6 years experience. Expert in React, TypeScript, Redux, Next.js, Jest, TailwindCSS.", 3, False),
            ("React Developer", "3 years experience. Built responsive SPAs in React, TypeScript, and CSS.", 2, False),
            ("Junior Frontend Trainee", "1 year experience in HTML, CSS, basic React components.", 1, False),
            ("Backend Java Dev", "Senior Java backend developer with Spring Boot and Kafka.", 0, False),
        ]),
    ]

    for j_idx, (job_title, job_text, cand_list) in enumerate(archetypes[:n_jobs]):
        jd_id = f"synth_jd_{j_idx}"
        for c_idx, (cand_title, cand_text, label_val, is_ko) in enumerate(cand_list[:candidates_per_job]):
            r_id = f"synth_res_{j_idx}_{c_idx}"
            pairs.append(
                LabeledPair(
                    pair_id=f"synth_pair_{j_idx}_{c_idx}",
                    resume_id=r_id,
                    jd_id=jd_id,
                    recruiter_label=label_val,
                    recruiter_rank=c_idx + 1,
                    resume_data={"raw_text": cand_text, "title": cand_title},
                    jd_data={"text": job_text, "title": job_title},
                    is_knockout_expected=is_ko,
                    is_synthetic=True,
                    metadata={"smoke_test": True},
                )
            )

    return EvaluationDataset(
        dataset_name="Synthetic_Smoke_Test_Dataset",
        description="Deterministic synthetic benchmark for CI/smoke evaluation (SYNTHETIC ONLY)",
        is_synthetic_dataset=True,
        pairs=pairs,
    )


async def export_from_mongodb(
    output_json_path: str = "backend/eval/exported_db_dataset.json",
    limit: int = 200,
) -> EvaluationDataset:
    """Exports candidate applications and matches directly from MongoDB collections."""
    from config.db import connect_db, get_database, disconnect_db
    await connect_db()
    db = get_database()

    pairs: List[LabeledPair] = []
    try:
        cursor = db.applications.find({"recruiter_rating": {"$exists": True}}).limit(limit)
        async for app_doc in cursor:
            r_id = str(app_doc.get("resume_id"))
            j_id = str(app_doc.get("job_id"))
            rating = int(app_doc.get("recruiter_rating", 0))

            res_doc = await db.resumes.find_one({"_id": r_id}) or {}
            job_doc = await db.jobs.find_one({"_id": j_id}) or {}

            pairs.append(
                LabeledPair(
                    pair_id=str(app_doc.get("_id")),
                    resume_id=r_id,
                    jd_id=j_id,
                    recruiter_label=min(3, max(0, rating)),
                    resume_data=res_doc,
                    jd_data=job_doc,
                    is_synthetic=False,
                )
            )
    finally:
        await disconnect_db()

    ds = EvaluationDataset(
        dataset_name="MongoDB_Exported_Dataset",
        description=f"Exported from MongoDB applications at {os.path.basename(output_json_path)}",
        is_synthetic_dataset=False,
        pairs=pairs,
    )

    out_p = Path(output_json_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    with open(out_p, "w", encoding="utf-8") as f:
        f.write(ds.model_dump_json(indent=2))

    return ds

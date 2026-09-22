"""
Reproducible Scoring Replay Script — CareerShala ATS Audit & Quality Control.

Usage:
    python backend/scripts/replay_score.py <result_id>
"""

import asyncio
import sys
from pathlib import Path
from bson import ObjectId

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.db import connect_db, disconnect_db, get_database
from services.scoring_engine import score_resume, WeightProfile, SCORING_ENGINE_VERSION
from services.skill_ontology import ONTOLOGY_VERSION
from services.embedding_service import EMBEDDING_MODEL_VERSION


async def replay_score_by_id(result_id: str, tolerance: float = 0.05) -> dict:
    db = get_database()
    try:
        oid = ObjectId(result_id)
        res_doc = await db.results.find_one({"_id": oid}) or await db.ats_results.find_one({"_id": oid})
    except Exception:
        res_doc = await db.results.find_one({"_id": result_id}) or await db.ats_results.find_one({"_id": result_id})

    if not res_doc:
        raise ValueError(f"ATS Result '{result_id}' not found in database.")

    stored_score = float(res_doc.get("quality_score") or res_doc.get("final_score") or res_doc.get("overall_score") or 0.0)
    stored_scoring_ver = res_doc.get("scoring_version")
    stored_ontology_ver = res_doc.get("ontology_version")
    stored_embed_ver = res_doc.get("embedding_model_version")

    # Version comparison check
    version_diffs = []
    if stored_scoring_ver and stored_scoring_ver != SCORING_ENGINE_VERSION:
        version_diffs.append(f"Scoring Engine: stored '{stored_scoring_ver}' vs active '{SCORING_ENGINE_VERSION}'")
    if stored_ontology_ver and stored_ontology_ver != ONTOLOGY_VERSION:
        version_diffs.append(f"Ontology: stored '{stored_ontology_ver}' vs active '{ONTOLOGY_VERSION}'")
    if stored_embed_ver and stored_embed_ver != EMBEDDING_MODEL_VERSION:
        version_diffs.append(f"Embedding Model: stored '{stored_embed_ver}' vs active '{EMBEDDING_MODEL_VERSION}'")

    if version_diffs:
        print("[WARNING] Version divergence detected between snapshot and active environment:")
        for diff in version_diffs:
            print(f"  - {diff}")

    # Reconstruct input payload
    resume_data = res_doc.get("extracted_data") or {"raw_text": res_doc.get("resume_text", "")}
    jd_data = {"description": res_doc.get("job_description", "")}
    mode = res_doc.get("mode", "candidate")

    # Rebuild WeightProfile if snapshot available
    weights_snap = res_doc.get("weights_snapshot")
    custom_profile = None
    if weights_snap and isinstance(weights_snap, dict):
        try:
            custom_profile = WeightProfile(**weights_snap)
        except Exception:
            pass

    # Recompute score
    replayed = score_resume(
        resume=resume_data,
        jd=jd_data,
        mode=mode,
        profile=custom_profile,
    )

    replayed_score = float(replayed["quality_score"])
    delta = abs(stored_score - replayed_score)
    is_reproducible = delta <= tolerance

    report = {
        "result_id": result_id,
        "stored_score": stored_score,
        "replayed_score": replayed_score,
        "delta": round(delta, 4),
        "tolerance": tolerance,
        "is_reproducible": is_reproducible,
        "version_diffs": version_diffs,
    }

    print("=" * 60)
    print("CAREERSHALA SCORE REPLAY VERIFICATION")
    print("=" * 60)
    print(f"Result ID:       {result_id}")
    print(f"Stored Score:    {stored_score:.2f}")
    print(f"Replayed Score:  {replayed_score:.2f}")
    print(f"Delta:           {delta:.4f} (Tolerance <= {tolerance})")
    print(f"Reproducible:    {'PASSED' if is_reproducible else 'FAILED'}")
    print("=" * 60)

    if not is_reproducible:
        raise AssertionError(f"Score replay drift ({delta:.4f}) exceeds tolerance ({tolerance}).")

    return report


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python backend/scripts/replay_score.py <result_id>")
        sys.exit(1)

    res_id = sys.argv[1]
    async def main():
        await connect_db()
        try:
            await replay_score_by_id(res_id)
        finally:
            await disconnect_db()

    asyncio.run(main())

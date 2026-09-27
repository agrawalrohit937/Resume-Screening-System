"""
Vector Calibration Module — Re-exports calibration functions from tools/scripts for backend test suites.
"""
from pathlib import Path
import sys

_TOOLS_PATH = Path(__file__).resolve().parent.parent.parent / "tools" / "scripts"
if str(_TOOLS_PATH) not in sys.path:
    sys.path.insert(0, str(_TOOLS_PATH))

import calibrate_vector_scores  # noqa: E402
from calibrate_vector_scores import run_calibration, fetch_sample_pairs_from_db  # noqa: E402


def main():
    if hasattr(calibrate_vector_scores, "main"):
        calibrate_vector_scores.main()
    elif hasattr(calibrate_vector_scores, "main_async"):
        import asyncio
        asyncio.run(calibrate_vector_scores.main_async())


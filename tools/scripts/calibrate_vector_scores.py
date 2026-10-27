"""
Vector Calibration CLI Tool Wrapper.
Re-exports from backend.scripts.calibrate_vector_scores.
"""
from pathlib import Path
import sys

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from scripts.calibrate_vector_scores import main, run_calibration  # noqa: F401, E402

if __name__ == "__main__":
    main()

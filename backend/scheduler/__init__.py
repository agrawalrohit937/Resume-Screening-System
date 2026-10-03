"""
Background Schedulers Package for Automated Retention Loops & AI Batch Tasks.
"""

from .job_alerts import (
    start_job_alert_scheduler,
    stop_job_alert_scheduler,
    run_nightly_job_alerts,
    job_alerts_scheduler,
    recover_missed_job_alerts_on_startup,
    calculate_slot_id,
    get_eligible_missed_slot,
)

__all__ = [
    "start_job_alert_scheduler",
    "stop_job_alert_scheduler",
    "run_nightly_job_alerts",
    "job_alerts_scheduler",
    "recover_missed_job_alerts_on_startup",
    "calculate_slot_id",
    "get_eligible_missed_slot",
]


"""
Celery Application Initialization and Configuration for CareerPilot ATS.
Provides distributed worker execution for CPU-intensive and long-running pipelines
(resume parsing, bulk re-scoring, batch embeddings).
"""

import os
import re
import structlog
from typing import Optional

logger = structlog.get_logger(__name__)

celery_app = None

try:
    from celery import Celery

    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

    celery_app = Celery(
        "careerpilot_workers",
        broker=CELERY_BROKER_URL,
        backend=CELERY_RESULT_BACKEND,
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_acks_late=True,
        task_reject_on_worker_lost=True,
        worker_prefetch_multiplier=1,
        task_routes={
            "careerpilot.parse_resume": {"queue": "parsing"},
            "careerpilot.bulk_rescore": {"queue": "scoring"},
            "careerpilot.dlq": {"queue": "dlq"},
        },
        task_time_limit=300,  # 5 min hard limit
        task_soft_time_limit=240,  # 4 min soft limit
    )
    masked_broker = re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", CELERY_BROKER_URL) if CELERY_BROKER_URL else ""
    logger.info("Celery application initialized", broker=masked_broker)
except ImportError:
    logger.info("Celery not installed or unavailable, falling back to in-process async worker")
    celery_app = None
except Exception as e:
    logger.warning("Failed to initialize Celery, falling back to in-process worker", error=str(e))
    celery_app = None

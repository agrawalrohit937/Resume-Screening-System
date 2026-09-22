"""
Standalone Asynchronous Background Worker Entrypoint for CareerShala ATS.
========================================================================
Runs background consumers (arq / asyncio task runner / Celery) independently
from the FastAPI web application, allowing worker horizontal scalability.
"""

import asyncio
import os
import sys
import structlog
from core.config import settings
from config.db import connect_db, disconnect_db, get_database
from services.tasks.celery_app import celery_app

logger = structlog.get_logger("worker")


async def run_async_worker():
    """Initializes async connections and starts worker processing loops."""
    logger.info("Initializing CareerShala Asynchronous Worker Process", version=settings.APP_VERSION)
    await connect_db()
    db = get_database()
    logger.info("Worker database connection established", db_name=settings.MONGO_DB_NAME)

    try:
        while True:
            # Heartbeat / Worker liveness monitoring
            await asyncio.sleep(60)
            logger.debug("Worker heartbeat tick")
    except asyncio.CancelledError:
        logger.info("Worker cancellation requested")
    finally:
        await disconnect_db()
        logger.info("Worker shutdown completed")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "celery" and celery_app is not None:
        logger.info("Starting Celery Worker Process")
        celery_app.worker_main(argv=["worker", "--loglevel=info", "-E"])
    else:
        asyncio.run(run_async_worker())


if __name__ == "__main__":
    main()

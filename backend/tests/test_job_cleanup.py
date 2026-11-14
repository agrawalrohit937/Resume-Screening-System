"""
Unit tests for Job Cleanup Service (Automated removal of stale external jobs).
100% Native PostgreSQL via SQLAlchemy 2.0.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from tests.conftest import MockAsyncSession
from services.job_scraper import cleanup_stale_external_jobs


@pytest.mark.asyncio
async def test_cleanup_stale_external_jobs_success():
    executed_stmts = []

    class MockCleanupSession(MockAsyncSession):
        async def execute(self, stmt, *args, **kwargs):
            executed_stmts.append(stmt)
            res = MagicMock()
            res.rowcount = 12
            return res

    mock_session_factory = lambda: MockCleanupSession()

    result = await cleanup_stale_external_jobs(session_factory=mock_session_factory, max_age_days=7)

    assert result["success"] is True
    assert result["deleted_count"] == 12
    assert result["max_age_days"] == 7
    assert "cutoff" in result

    # Verify SQL delete executed
    assert len(executed_stmts) == 1
    stmt = str(executed_stmts[0]).lower()
    assert "delete from jobs" in stmt
    assert "is_external" in stmt
    assert "created_at" in stmt
    assert "updated_at" not in stmt


@pytest.mark.asyncio
async def test_cleanup_stale_external_jobs_error_handling():
    class FailingContext:
        async def __aenter__(self):
            raise RuntimeError("Database connection timeout")
        async def __aexit__(self, *args):
            pass

    mock_session_factory = MagicMock(return_value=FailingContext())

    result = await cleanup_stale_external_jobs(session_factory=mock_session_factory, max_age_days=7)

    assert result["success"] is False
    assert result["deleted_count"] == 0
    assert "Database connection timeout" in result["error"]


def test_resolve_queries_for_slot_rotation():
    from services.job_scraper import (
        resolve_queries_for_slot,
        MORNING_QUERIES,
        AFTERNOON_QUERIES,
    )

    morning = resolve_queries_for_slot("morning")
    assert morning == MORNING_QUERIES
    assert "Fresher Software Engineer in India" in morning

    afternoon = resolve_queries_for_slot("afternoon")
    assert afternoon == AFTERNOON_QUERIES
    assert "Frontend Developer React in India" in afternoon

    # Verify no overlap between morning and afternoon to maximize unique job discovery
    assert set(morning).isdisjoint(set(afternoon))



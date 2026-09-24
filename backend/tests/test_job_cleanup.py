"""
Unit tests for Job Cleanup Service (Automated removal of stale external jobs).
"""

from datetime import datetime, timedelta, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock

from services.job_cleanup_service import cleanup_stale_external_jobs


@pytest.mark.asyncio
async def test_cleanup_stale_external_jobs_success():
    mock_coll = MagicMock()
    mock_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=12))

    mock_db = MagicMock()
    mock_db._raw_db = {"jobs": mock_coll}

    result = await cleanup_stale_external_jobs(mock_db, max_age_days=7)

    assert result["success"] is True
    assert result["deleted_count"] == 12
    assert result["max_age_days"] == 7
    assert "cutoff" in result

    # Verify query strictly isolates is_external: True
    call_args = mock_coll.delete_many.call_args[0][0]
    assert "$in" in call_args["is_external"]
    assert True in call_args["is_external"]["$in"]
    assert "$or" in call_args


@pytest.mark.asyncio
async def test_cleanup_stale_external_jobs_error_handling():
    mock_coll = MagicMock()
    mock_coll.delete_many = AsyncMock(side_effect=RuntimeError("Mongo connection timeout"))

    mock_db = MagicMock()
    mock_db._raw_db = {"jobs": mock_coll}

    result = await cleanup_stale_external_jobs(mock_db, max_age_days=7)

    assert result["success"] is False
    assert result["deleted_count"] == 0
    assert "Mongo connection timeout" in result["error"]

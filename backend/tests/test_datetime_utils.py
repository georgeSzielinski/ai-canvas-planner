from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.core.datetime_utils import as_utc, provider_datetime_utc, utcnow


def test_as_utc_normalizes_aware_offsets_and_sqlite_naive_utc() -> None:
    utc_value = datetime.fromisoformat("2026-07-22T20:00:00+00:00")
    offset_value = datetime.fromisoformat("2026-07-22T13:00:00-07:00")
    sqlite_value = datetime(2026, 7, 22, 20, 0)

    assert as_utc(utc_value) == utc_value
    assert as_utc(offset_value) == utc_value
    assert as_utc(sqlite_value) == utc_value
    assert as_utc(None) is None
    assert utcnow().tzinfo is UTC


def test_provider_datetime_requires_timezone_and_normalizes_to_utc() -> None:
    offset = timezone(timedelta(hours=-7))
    assert provider_datetime_utc(datetime(2026, 7, 22, 13, 0, tzinfo=offset)) == datetime(
        2026, 7, 22, 20, 0, tzinfo=UTC
    )

    with pytest.raises(ValueError, match="timezone"):
        provider_datetime_utc(datetime(2026, 7, 22, 20, 0))

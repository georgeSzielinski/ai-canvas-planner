"""UTC datetime policy for persisted and provider timestamps.

All persisted datetimes in this project represent UTC. PostgreSQL preserves timezone
metadata, while SQLite returns the same stored UTC wall-clock values as naive
``datetime`` objects. ``as_utc`` restores UTC only at that database boundary;
provider timestamps must use ``provider_datetime_utc`` and are never allowed to be
naive.
"""

from datetime import UTC, datetime
from typing import overload


@overload
def as_utc(value: datetime) -> datetime: ...


@overload
def as_utc(value: None) -> None: ...


def as_utc(value: datetime | None) -> datetime | None:
    """Return an internal datetime in UTC, restoring SQLite's omitted UTC tzinfo."""
    if value is None:
        return None
    if value.utcoffset() is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def provider_datetime_utc(value: datetime) -> datetime:
    """Require an aware provider timestamp and normalize its instant to UTC."""
    if value.utcoffset() is None:
        raise ValueError("Provider datetime must include a timezone offset")
    return value.astimezone(UTC)


def utcnow() -> datetime:
    return datetime.now(UTC)

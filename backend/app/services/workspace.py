from copy import deepcopy
from typing import Any

from sqlalchemy.orm import Session

from app.models import UserSettings


def initialize_user_workspace(
    database: Session, user_id: str, settings_payload: dict[str, Any]
) -> None:
    """Create an empty, isolated workspace for a first-time user."""
    payload = deepcopy(settings_payload)
    payload["subjects"] = []
    database.add(UserSettings(id=f"settings-{user_id}", user_id=user_id, payload=payload))

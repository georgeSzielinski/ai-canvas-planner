"""Neutral defaults for newly authenticated workspaces.

These values are product defaults only. They contain no courses, assignments,
routines, identities, provider state, or inferred user history.
"""

from copy import deepcopy
from typing import Any

DEFAULT_SETTINGS: dict[str, Any] = {
    "profile": {
        "id": "",
        "display_name": "",
        "time_zone": "UTC",
        "school_year": "",
        "week_start": "monday",
        "theme": "system",
    },
    "study": {
        "earliest_time": "07:00",
        "latest_time": "22:00",
        "preferred_session_minutes": 45,
        "max_session_minutes": 90,
        "break_minutes": 10,
        "weekday_workload_minutes": 120,
        "weekend_workload_minutes": 180,
        "minimum_free_minutes": 30,
        "emergency_buffer_minutes": 30,
        "study_before_school": False,
        "study_at_lunch": False,
        "study_after_rowing": False,
        "friday_night": "normal",
        "saturday_night": "normal",
        "sunday_night": "normal",
    },
    "sleep": {
        "current_bedtime": "23:00",
        "target_bedtime": "23:00",
        "wake_time": "07:00",
        "gradual_adjustment": False,
        "protect_sleep": True,
        "prevent_late_study": True,
        "athlete_recovery_mode": False,
        "avoid_intense_after_training": False,
    },
    "subjects": [],
    "calendar": {
        "study_calendar": "",
        "busy_calendars": [],
        "automatic_publishing": False,
        "preview_before_publishing": True,
        "notifications": True,
        "canvai_may_move_own_events": False,
        "preserve_manual_edits": True,
    },
    "ai": {
        "enabled": False,
        "provider": "",
        "analysis_depth": "balanced",
        "show_reasoning": True,
        "automatic_duration": False,
        "automatic_classification": False,
        "use_completion_history": False,
        "ask_before_major_changes": True,
        "estimate_feedback": False,
    },
    "rules": {
        "tests_extra_priority": True,
        "start_essays_early": True,
        "split_long_assignments": True,
        "create_project_milestones": True,
        "missing_overrides": True,
        "delay_low_value_when_overloaded": True,
        "allow_same_course_sessions": False,
        "include_prep_instructions": True,
        "rebuild_missed_schedules": True,
        "keep_sunday_light": False,
        "protect_daily_free_time": True,
    },
}


def default_settings() -> dict[str, Any]:
    return deepcopy(DEFAULT_SETTINGS)

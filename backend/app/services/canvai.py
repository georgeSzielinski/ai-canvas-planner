import re

from app.schemas.domain import ScheduleChangeSchema, ScheduleProposalSchema

CHANGE_MAP: dict[str, list[ScheduleChangeSchema]] = {
    "Make tonight lighter": [
        ScheduleChangeSchema(
            id="move-physics",
            kind="move",
            label="Move Physics review",
            before="Tonight · 9:25 PM",
            after="Thursday · 7:10 AM",
        ),
        ScheduleChangeSchema(
            id="protect-winddown",
            kind="protect",
            label="Restore wind-down time",
            before="10:30 PM",
            after="9:45 PM",
        ),
    ],
    "Protect sleep": [
        ScheduleChangeSchema(
            id="protect-cutoff",
            kind="protect",
            label="Lock the study cutoff",
            before="Flexible",
            after="10:15 PM",
        )
    ],
    "Keep Sunday light": [
        ScheduleChangeSchema(
            id="move-essay",
            kind="move",
            label="Start the English essay earlier",
            before="Sunday · 90 minutes",
            after="Thursday · 40 minutes / Saturday · 50 minutes",
        )
    ],
    "Prepare for the Physics test": [
        ScheduleChangeSchema(
            id="add-physics",
            kind="add",
            label="Add a recall review",
            after="Thursday · 7:10 AM · 20 minutes",
        ),
        ScheduleChangeSchema(
            id="split-physics",
            kind="move",
            label="Split tonight’s Physics prep",
            before="45 minutes",
            after="30 tonight + 15 Thursday",
        ),
    ],
    "Find time for lifting": [
        ScheduleChangeSchema(
            id="add-lifting",
            kind="add",
            label="Reserve a lifting block",
            after="Saturday · 10:00 AM · 60 minutes",
        )
    ],
    "Rebuild the week": [
        ScheduleChangeSchema(
            id="move-business",
            kind="move",
            label="Move Business slide work",
            before="Sunday · 2:00 PM",
            after="Saturday · 11:15 AM",
        ),
        ScheduleChangeSchema(
            id="add-buffer",
            kind="protect",
            label="Add recovery buffer after rowing",
            after="20 minutes on weekdays",
        ),
    ],
}


def propose(command: str) -> ScheduleProposalSchema:
    changes = CHANGE_MAP.get(
        command,
        [
            ScheduleChangeSchema(
                id="custom",
                kind="move",
                label=command,
                before="Current demo plan",
                after="Balanced demo plan",
            )
        ],
    )
    slug = re.sub(r"[^a-z0-9]+", "-", command.lower()).strip("-")
    return ScheduleProposalSchema(
        id=f"proposal-{slug}",
        command=command,
        summary=f"{len(changes)} focused change{'s' if len(changes) != 1 else ''} to rebalance your week.",
        reasoning="This keeps important work moving without placing study over school, training, meals, or protected sleep.",
        changes=changes,
    )

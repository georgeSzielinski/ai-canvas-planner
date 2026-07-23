import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit


@dataclass(frozen=True)
class AssignmentClassification:
    category: str
    reason: str


class _PlainTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.suppressed_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in {"script", "style", "noscript", "template"}:
            self.suppressed_depth += 1
        elif not self.suppressed_depth and tag in {
            "br",
            "p",
            "div",
            "li",
            "tr",
            "h1",
            "h2",
            "h3",
            "h4",
        }:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "template"} and self.suppressed_depth:
            self.suppressed_depth -= 1
        elif not self.suppressed_depth and tag in {"p", "div", "li", "tr", "h1", "h2", "h3", "h4"}:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self.suppressed_depth:
            self.parts.append(data)


def sanitize_canvas_html(value: str | None) -> str:
    if not value:
        return ""
    parser = _PlainTextParser()
    try:
        parser.feed(value)
        parser.close()
    except (ValueError, TypeError):
        return ""
    return re.sub(r"\s+", " ", "".join(parser.parts)).strip()


def validate_canvas_url(value: str | None, base_url: str) -> str | None:
    if not value:
        return None
    candidate = urljoin(f"{base_url.rstrip('/')}/", value.strip())
    expected = urlsplit(base_url)
    parsed = urlsplit(candidate)
    if (
        parsed.scheme != expected.scheme
        or parsed.netloc != expected.netloc
        or parsed.username
        or parsed.password
        or parsed.scheme not in {"http", "https"}
    ):
        return None
    return candidate


_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("test", ("exam", "midterm", "final test", "unit test", "test")),
    ("quiz", ("quiz",)),
    ("essay", ("essay", "writing", "paper", "composition")),
    ("project", ("project", "capstone")),
    ("reading", ("reading", "read chapter", "read chapters", "read pages")),
    ("discussion", ("discussion", "forum")),
    ("worksheet", ("worksheet", "problem set", "homework set", "practice set")),
    ("presentation", ("presentation", "speech", "slide deck")),
    ("lab", ("laboratory", "lab report", " lab", "lab ")),
)


def classify_assignment(
    name: str,
    assignment_group: str | None,
    submission_types: list[str],
) -> AssignmentClassification:
    normalized = " ".join(filter(None, [name, assignment_group or ""])).casefold()
    normalized = re.sub(r"\s+", " ", f" {normalized} ")
    lowered_submission_types = {item.casefold() for item in submission_types}
    if "online_quiz" in lowered_submission_types:
        return AssignmentClassification("quiz", "Canvas submission type is online_quiz.")
    if "discussion_topic" in lowered_submission_types:
        return AssignmentClassification("discussion", "Canvas submission type is discussion_topic.")
    for category, terms in _RULES:
        for term in terms:
            if term in normalized:
                return AssignmentClassification(
                    category,
                    f"Matched deterministic keyword “{term.strip()}” in the assignment name or group.",
                )
    return AssignmentClassification(
        "other",
        "No deterministic category keyword or Canvas submission type matched.",
    )

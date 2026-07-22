"use client";

import { useMemo, useState } from "react";
import {
  ArrowClockwise,
  CalendarPlus,
  Check,
  Clock,
  Funnel,
  Link as LinkIcon,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useApp } from "@/components/common/app-provider";
import { ManualAssignmentModal } from "@/components/assignments/manual-assignment-modal";
import { Badge, Button, Card, EmptyState, Modal, SectionHeader } from "@/components/common/ui";

import { calendarService } from "@/services/calendar-service";
import { courseToneClass } from "@/lib/course-style";
import { DEMO_REFERENCE_DATE, formatDemoDate } from "@/lib/demo-date";
import type { Assignment, Course, Priority, StudySession } from "@/types/domain";

type Tab = "focus" | "upcoming" | "missing" | "completed" | "all";
type Sort = "recommended" | "due" | "priority" | "duration" | "course";
const priorityRank: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const tabLabels: { id: Tab; label: string }[] = [
  { id: "focus", label: "Focus" },
  { id: "upcoming", label: "Upcoming" },
  { id: "missing", label: "Missing" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

export function filterAssignments(
  items: Assignment[],
  courses: Course[],
  query: string,
  tab: Tab,
  filters: Record<string, string>,
) {
  const now = new Date(DEMO_REFERENCE_DATE).getTime();
  return items.filter((item) => {
    const course = courses.find((value) => value.id === item.courseId)?.name ?? "";
    const matchesQuery = `${item.title} ${course} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const tabMatch =
      tab === "all" ||
      (tab === "focus" &&
        item.completionState === "open" &&
        (item.priority === "urgent" || item.priority === "high")) ||
      (tab === "upcoming" &&
        item.completionState === "open" &&
        new Date(item.dueAt).getTime() >= now) ||
      (tab === "missing" && item.missing) ||
      (tab === "completed" && item.completionState === "completed");
    const due = new Date(item.dueAt).getTime();
    const dueMatch =
      filters.due === "" ||
      (filters.due === "48h" && due >= now && due <= now + 172800000) ||
      (filters.due === "week" && due >= now && due <= now + 604800000) ||
      (filters.due === "overdue" && due < now);
    return (
      matchesQuery &&
      tabMatch &&
      (!filters.course || item.courseId === filters.course) &&
      (!filters.type || item.type === filters.type) &&
      (!filters.priority || item.priority === filters.priority) &&
      (!filters.completion || item.completionState === filters.completion) &&
      (!filters.scheduled ||
        (filters.scheduled === "yes") === item.scheduledSessionIds.length > 0) &&
      (!filters.missing || (filters.missing === "yes") === item.missing) &&
      dueMatch
    );
  });
}

export function AssignmentsPage({ initialAssignmentId = "" }: { initialAssignmentId?: string }) {
  const {
    backendMode,
    calendarConnection,
    courses,
    loading,
    assignments,
    sessions,
    updateAssignment,
    addSession,
    removeSession,
    showToast,
  } = useApp();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("focus");
  const [sort, setSort] = useState<Sort>("recommended");
  const [filters, setFilters] = useState({
    course: "",
    type: "",
    priority: "",
    completion: "",
    scheduled: "",
    due: "",
    missing: "",
  });
  const [publishingSessionId, setPublishingSessionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(initialAssignmentId || "assignment-missing");
  const [manualOpen, setManualOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimate, setEstimate] = useState(45);
  const [mobileDetail, setMobileDetail] = useState(false);

  const filtered = useMemo(() => {
    const result = filterAssignments(assignments, courses, query, tab, filters);
    return [...result].sort((a, b) =>
      sort === "recommended"
        ? b.analysis.priorityScore - a.analysis.priorityScore
        : sort === "due"
          ? +new Date(a.dueAt) - +new Date(b.dueAt)
          : sort === "priority"
            ? priorityRank[b.priority] - priorityRank[a.priority]
            : sort === "duration"
              ? b.estimatedMinutes - a.estimatedMinutes
              : (courses.find((c) => c.id === a.courseId)?.name ?? "").localeCompare(
                  courses.find((c) => c.id === b.courseId)?.name ?? "",
                ),
    );
  }, [assignments, courses, query, tab, filters, sort]);
  const selected = assignments.find((item) => item.id === selectedId) ?? filtered[0];
  const selectedCourse = selected ? courses.find((item) => item.id === selected.courseId)! : null;
  const selectAssignment = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  const publishSession = async (session: StudySession) => {
    setPublishingSessionId(session.id);
    try {
      const preview = await calendarService.previewStudySession(session.id);
      const confirmed = window.confirm(
        `Publish “${preview.title}” to Google Calendar from ${new Date(preview.starts_at).toLocaleString()} to ${new Date(preview.ends_at).toLocaleString()}?`,
      );
      if (!confirmed) return;
      const result = await calendarService.publishStudySession(
        session.id,
        preview.confirmation_token,
      );
      showToast(`Calendar event ${result.action}.`);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not publish the study session.");
    } finally {
      setPublishingSessionId(null);
    }
  };
  const counts = Object.fromEntries(
    tabLabels.map(({ id }) => [
      id,
      filterAssignments(assignments, courses, "", id, {
        course: "",
        type: "",
        priority: "",
        completion: "",
        scheduled: "",
        due: "",
        missing: "",
      }).length,
    ]),
  );
  const changeFilter = (key: string, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const selectedSessions = selected
    ? sessions.filter((session) => selected.scheduledSessionIds.includes(session.id))
    : [];

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Assignments</h1>
          <p>Every deadline, priority, estimate, and planned session in one place.</p>
        </div>
        <div className="page-actions">
          <Badge tone="warning">Canvas integration not enabled</Badge>
          {!backendMode && (
            <Button variant="primary" icon={<Plus />} onClick={() => setManualOpen(true)}>
              Manual assignment
            </Button>
          )}
        </div>
      </div>
      <Card>
        <div className="assignment-toolbar">
          <label className="search-wrap">
            <span className="sr-only">Search assignments</span>
            <MagnifyingGlass />
            <input
              className="text-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search assignments or courses…"
            />
          </label>
          <label className="field">
            <span className="sr-only">Sort assignments</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="recommended">Recommended</option>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
              <option value="duration">Estimated duration</option>
              <option value="course">Course</option>
            </select>
          </label>
          <Button
            icon={<Funnel />}
            onClick={() =>
              setFilters({
                course: "",
                type: "",
                priority: "",
                completion: "",
                scheduled: "",
                due: "",
                missing: "",
              })
            }
          >
            Clear filters
          </Button>
        </div>
        <div className="tabs" role="tablist" aria-label="Assignment groups">
          {tabLabels.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label} <span className="mono">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="filters-panel">
          {[
            [
              "course",
              "Course",
              <>
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option value={course.id} key={course.id}>
                    {course.name}
                  </option>
                ))}
              </>,
            ],
            [
              "type",
              "Type",
              <>
                <option value="">All types</option>
                {["essay", "homework", "test", "presentation", "reading", "project"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </>,
            ],
            [
              "priority",
              "Priority",
              <>
                <option value="">All priorities</option>
                {["urgent", "high", "medium", "low"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </>,
            ],
            [
              "completion",
              "Completion",
              <>
                <option value="">Any state</option>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
              </>,
            ],
            [
              "scheduled",
              "Scheduled",
              <>
                <option value="">Any schedule</option>
                <option value="yes">Scheduled</option>
                <option value="no">Not scheduled</option>
              </>,
            ],
            [
              "due",
              "Due date",
              <>
                <option value="">Any date</option>
                <option value="48h">Next 48 hours</option>
                <option value="week">Next 7 days</option>
                <option value="overdue">Overdue</option>
              </>,
            ],
            [
              "missing",
              "Missing",
              <>
                <option value="">Any status</option>
                <option value="yes">Missing only</option>
                <option value="no">Not missing</option>
              </>,
            ],
          ].map(([key, label, options]) => (
            <label className="field" key={key as string}>
              <span>{label as string}</span>
              <select
                value={filters[key as keyof typeof filters]}
                onChange={(event) => changeFilter(key as string, event.target.value)}
              >
                {options}
              </select>
            </label>
          ))}
        </div>
      </Card>
      <div className="assignment-layout">
        <Card className="assignment-list">
          {loading ? (
            <EmptyState title="Loading assignments" body="Loading your saved workspace…" />
          ) : filtered.length ? (
            filtered.map((assignment) => {
              const course = courses.find((item) => item.id === assignment.courseId)!;
              return (
                <button
                  className={`assignment-row ${selected?.id === assignment.id ? "selected" : ""}`}
                  key={assignment.id}
                  onClick={() => selectAssignment(assignment.id)}
                >
                  <i className={`course-line ${courseToneClass(course.id)}`} />
                  <div>
                    <div className="assignment-row-top">
                      <h3>{assignment.title}</h3>
                      {assignment.missing && <Badge tone="danger">MISSING</Badge>}
                      {assignment.completionState === "completed" && (
                        <Badge tone="success">COMPLETED</Badge>
                      )}
                      <Badge
                        tone={
                          assignment.priority === "urgent"
                            ? "danger"
                            : assignment.priority === "high"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {assignment.priority}
                      </Badge>
                    </div>
                    <p>
                      <span>{course.name}</span>
                      <span>{formatDemoDate(assignment.dueAt)}</span>
                      <span>{assignment.estimatedMinutes} min</span>
                      <span>
                        {assignment.scheduledSessionIds.length
                          ? `${assignment.scheduledSessionIds.length} session`
                          : "Not scheduled"}
                      </span>
                    </p>
                  </div>
                  <span className={`priority-score ${assignment.priority}`}>
                    {assignment.analysis.priorityScore}
                  </span>
                </button>
              );
            })
          ) : (
            <EmptyState
              title="No assignments match"
              body="Try a different tab, search, or filter. Your assignments have not been changed."
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setTab("all");
                    setFilters({
                      course: "",
                      type: "",
                      priority: "",
                      completion: "",
                      scheduled: "",
                      due: "",
                      missing: "",
                    });
                  }}
                >
                  Show all assignments
                </Button>
              }
            />
          )}
        </Card>
        {selected && selectedCourse && (
          <Card className={`assignment-detail ${mobileDetail ? "mobile-open" : ""}`}>
            <SectionHeader
              title="Assignment details"
              aside={
                <button
                  className="icon-button mobile-only"
                  onClick={() => setMobileDetail(false)}
                  aria-label="Close details"
                >
                  <X />
                </button>
              }
            />
            <div className="detail-content">
              <div className="assignment-kicker">
                <span className={`course-chip ${courseToneClass(selectedCourse.id)}`}>
                  <i />
                  {selectedCourse.name}
                </span>
                <Badge
                  tone={
                    selected.priority === "urgent"
                      ? "danger"
                      : selected.priority === "high"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {selected.priority.toUpperCase()}
                </Badge>
              </div>
              <h2>{selected.title}</h2>
              <p className="detail-description">{selected.description}</p>
              <div className="detail-facts">
                <div className="detail-fact">
                  <small>Due</small>
                  <strong>{formatDemoDate(selected.dueAt)}</strong>
                </div>
                <div className="detail-fact">
                  <small>Points / weight</small>
                  <strong>
                    {selected.points} pts{selected.gradeWeight ? ` · ${selected.gradeWeight}%` : ""}
                  </strong>
                </div>
                <div className="detail-fact">
                  <small>Estimated</small>
                  <strong>{selected.estimatedMinutes} minutes</strong>
                </div>
                <div className="detail-fact">
                  <small>Difficulty / urgency</small>
                  <strong>
                    {selected.analysis.difficulty}/5 · {selected.analysis.urgency}/5
                  </strong>
                </div>
                <div className="detail-fact">
                  <small>Submission</small>
                  <strong>{selected.submissionStatus.replaceAll("_", " ")}</strong>
                </div>
                <div className="detail-fact">
                  <small>Priority score</small>
                  <strong>{selected.analysis.priorityScore}/100</strong>
                </div>
              </div>
              <div className="canvai-callout">
                <SparkleIcon />
                <span>{selected.analysis.explanation}</span>
              </div>
              <div className="detail-section">
                <h3>Suggested preparation</h3>
                {selected.analysis.suggestedSteps.length ? (
                  <ol className="steps-list">
                    {selected.analysis.suggestedSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted" style={{ fontSize: 12 }}>
                    No more preparation needed.
                  </p>
                )}
              </div>
              <div className="detail-section">
                <h3>Planned sessions</h3>
                <div className="stack" style={{ gap: 7 }}>
                  {selectedSessions.length ? (
                    selectedSessions.map((session) => (
                      <div className="session-row" key={session.id}>
                        <Clock />
                        <span>
                          <strong>{session.title}</strong>
                          <small>
                            {formatDemoDate(session.startAt)} · {session.durationMinutes} min
                          </small>
                        </span>
                        {backendMode && calendarConnection?.connected && (
                          <button
                            disabled={publishingSessionId === session.id}
                            onClick={() => void publishSession(session)}
                            aria-label={`Publish ${session.title} to Google Calendar`}
                            title="Preview and publish to Google Calendar"
                          >
                            <CalendarPlus />
                          </button>
                        )}
                        {!backendMode && (
                          <button
                            onClick={() => removeSession(selected.id, session.id)}
                            aria-label={`Remove ${session.title}`}
                          >
                            <Trash />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="muted" style={{ fontSize: 12 }}>
                      No study sessions yet.
                    </p>
                  )}
                </div>
              </div>
              <div className="detail-actions">
                <Button
                  variant="primary"
                  icon={selected.completionState === "completed" ? <ArrowClockwise /> : <Check />}
                  onClick={() => {
                    updateAssignment(selected.id, {
                      completionState:
                        selected.completionState === "completed" ? "open" : "completed",
                      submissionStatus:
                        selected.completionState === "completed" ? "in_progress" : "submitted",
                      missing: false,
                    });
                    showToast(
                      selected.completionState === "completed"
                        ? "Assignment reopened"
                        : "Assignment marked complete",
                    );
                  }}
                >
                  {selected.completionState === "completed" ? "Reopen" : "Mark complete"}
                </Button>
                <Button
                  icon={<PencilSimple />}
                  onClick={() => {
                    setEstimate(selected.estimatedMinutes);
                    setEstimateOpen(true);
                  }}
                >
                  Edit estimate
                </Button>
                {!backendMode && (
                  <>
                    <Button icon={<CalendarPlus />} onClick={() => addSession(selected.id)}>
                      {selectedSessions.length ? "Reschedule" : "Schedule"}
                    </Button>
                    <Button icon={<Plus />} onClick={() => addSession(selected.id)}>
                      Add study block
                    </Button>
                  </>
                )}
                <Button
                  icon={<LinkIcon />}
                  onClick={() => showToast("Canvas link is a safe placeholder in Phase 1")}
                >
                  Open in Canvas
                </Button>
                <Button
                  icon={<ArrowClockwise />}
                  onClick={() => showToast("Canvai prepared a local reschedule preview")}
                >
                  Plan with Canvai
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
      <ManualAssignmentModal open={manualOpen} onClose={() => setManualOpen(false)} />
      <Modal
        open={estimateOpen}
        onClose={() => setEstimateOpen(false)}
        title="Edit time estimate"
        description="Canvai will use the new estimate in future demo proposals."
      >
        <label className="field">
          <span>Estimated minutes</span>
          <input
            aria-label="Estimated minutes"
            type="number"
            min={10}
            max={600}
            value={estimate}
            onChange={(event) => setEstimate(Number(event.target.value))}
          />
        </label>
        <div className="form-actions">
          <Button onClick={() => setEstimateOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (selected) updateAssignment(selected.id, { estimatedMinutes: estimate });
              setEstimateOpen(false);
              showToast("Estimate updated");
            }}
          >
            Save estimate
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SparkleIcon() {
  return <span aria-hidden="true">✦</span>;
}

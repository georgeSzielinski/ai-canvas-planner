"use client";

import { useMemo, useRef, useState } from "react";
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
  Warning,
  X,
} from "@phosphor-icons/react";
import { useApp } from "@/components/common/app-provider";
import { ManualAssignmentModal } from "@/components/assignments/manual-assignment-modal";
import { Badge, Button, Card, EmptyState, Modal, SectionHeader } from "@/components/common/ui";

import { calendarService } from "@/services/calendar-service";
import { courseToneClass } from "@/lib/course-style";
import { formatDate } from "@/lib/date";
import type { Assignment, Course, Priority, StudySession } from "@/types/domain";

function assignmentDate(value: string | null, backendMode: boolean): string {
  if (!value) return "No due date";
  if (!backendMode) return formatDate(value);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function dueTimestamp(value: string | null): number {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

type Tab = "focus" | "upcoming" | "missing" | "late" | "no_due" | "completed" | "all";
type Sort = "recommended" | "due" | "priority" | "duration" | "course";
const priorityRank: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const tabLabels: { id: Tab; label: string }[] = [
  { id: "focus", label: "Focus" },
  { id: "upcoming", label: "Upcoming" },
  { id: "missing", label: "Missing" },
  { id: "late", label: "Late" },
  { id: "no_due", label: "No due date" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

export function filterAssignments(
  items: Assignment[],
  courses: Course[],
  query: string,
  tab: Tab,
  filters: Record<string, string>,
  referenceDate = new Date().toISOString(),
) {
  const now = new Date(referenceDate).getTime();
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
        item.dueAt !== null &&
        new Date(item.dueAt).getTime() >= now) ||
      (tab === "missing" && item.missing) ||
      (tab === "late" && item.late) ||
      (tab === "no_due" && item.dueAt === null) ||
      (tab === "completed" && item.completionState === "completed");
    const due = item.dueAt ? new Date(item.dueAt).getTime() : null;
    const dueMatch =
      filters.due === "" ||
      (filters.due === "48h" && due !== null && due >= now && due <= now + 172800000) ||
      (filters.due === "week" && due !== null && due >= now && due <= now + 604800000) ||
      (filters.due === "overdue" && due !== null && due < now) ||
      (filters.due === "none" && due === null);
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
      (!filters.late || (filters.late === "yes") === Boolean(item.late)) &&
      dueMatch
    );
  });
}

export function AssignmentsPage({ initialAssignmentId = "" }: { initialAssignmentId?: string }) {
  const {
    backendMode,
    calendarConnection,
    canvasConnection,
    canvasSyncReport,
    canvasLoading,
    canvasError,
    refreshCanvasWorkspace,
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
  const [tab, setTab] = useState<Tab>(backendMode ? "upcoming" : "focus");
  const [sort, setSort] = useState<Sort>("recommended");
  const [filters, setFilters] = useState({
    course: "",
    type: "",
    priority: "",
    completion: "",
    scheduled: "",
    due: "",
    missing: "",
    late: "",
  });
  const [publishingSessionId, setPublishingSessionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(initialAssignmentId || "assignment-missing");
  const [manualOpen, setManualOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimate, setEstimate] = useState(45);
  const [mobileDetail, setMobileDetail] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const referenceDate = new Date().toISOString();

  const filtered = useMemo(() => {
    const result = filterAssignments(assignments, courses, query, tab, filters, referenceDate);
    return [...result].sort((a, b) =>
      sort === "recommended"
        ? b.analysis.priorityScore - a.analysis.priorityScore
        : sort === "due"
          ? dueTimestamp(a.dueAt) - dueTimestamp(b.dueAt)
          : sort === "priority"
            ? priorityRank[b.priority] - priorityRank[a.priority]
            : sort === "duration"
              ? b.estimatedMinutes - a.estimatedMinutes
              : (courses.find((c) => c.id === a.courseId)?.name ?? "").localeCompare(
                  courses.find((c) => c.id === b.courseId)?.name ?? "",
                ),
    );
  }, [assignments, courses, query, tab, filters, sort, referenceDate]);
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
      filterAssignments(
        assignments,
        courses,
        "",
        id,
        {
          course: "",
          type: "",
          priority: "",
          completion: "",
          scheduled: "",
          due: "",
          missing: "",
          late: "",
        },
        referenceDate,
      ).length,
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
          <p>
            {backendMode
              ? "Real assignments and submission state imported from Canvas."
              : "Every deadline, priority, estimate, and planned session in one place."}
          </p>
        </div>
        <div className="page-actions">
          <Badge tone={canvasConnection?.connected ? "success" : "warning"}>
            {canvasConnection?.connected ? "Canvas connected" : "Canvas not connected"}
          </Badge>
          {backendMode && (
            <Button
              disabled={canvasLoading}
              onClick={() => void refreshCanvasWorkspace().catch(() => undefined)}
            >
              {canvasLoading ? "Refreshing…" : "Refresh workspace"}
            </Button>
          )}
          {!backendMode && (
            <Button variant="primary" icon={<Plus />} onClick={() => setManualOpen(true)}>
              Manual assignment
            </Button>
          )}
        </div>
      </div>
      {backendMode && canvasError && (
        <div className="warning-callout" role="status">
          <Warning />
          <span>{canvasError}</span>
        </div>
      )}
      {backendMode && canvasSyncReport?.status === "partial" && (
        <div className="warning-callout" role="alert">
          <Warning />
          <span>
            The latest Canvas sync was partial. Data from {canvasSyncReport.course_failures} course
            {canvasSyncReport.course_failures === 1 ? "" : "s"} may be stale; previously imported
            assignments were preserved.
          </span>
        </div>
      )}
      {backendMode && canvasConnection?.data_stale && canvasSyncReport?.status !== "partial" && (
        <div className="warning-callout" role="alert">
          <Warning />
          <span>
            Displayed Canvas data may be stale. Sync from Settings before relying on changes.
          </span>
        </div>
      )}
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
                late: "",
              })
            }
          >
            Clear filters
          </Button>
        </div>
        <div className="tabs" role="tablist" aria-label="Assignment groups">
          {tabLabels.map(({ id, label }, index) => (
            <button
              key={id}
              id={`assignment-tab-${id}`}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              aria-selected={tab === id}
              aria-controls="assignment-tabpanel"
              tabIndex={tab === id ? 0 : -1}
              className={`tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
              onKeyDown={(event) => {
                let nextIndex = index;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % tabLabels.length;
                else if (event.key === "ArrowLeft") {
                  nextIndex = (index - 1 + tabLabels.length) % tabLabels.length;
                } else if (event.key === "Home") nextIndex = 0;
                else if (event.key === "End") nextIndex = tabLabels.length - 1;
                else return;
                event.preventDefault();
                setTab(tabLabels[nextIndex].id);
                tabRefs.current[nextIndex]?.focus();
              }}
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
                {[
                  "test",
                  "quiz",
                  "essay",
                  "project",
                  "reading",
                  "discussion",
                  "worksheet",
                  "presentation",
                  "lab",
                  "homework",
                  "other",
                ].map((v) => (
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
                <option value="none">No due date</option>
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
            [
              "late",
              "Late",
              <>
                <option value="">Any status</option>
                <option value="yes">Late only</option>
                <option value="no">Not late</option>
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
      <div
        className="assignment-layout"
        id="assignment-tabpanel"
        role="tabpanel"
        aria-labelledby={`assignment-tab-${tab}`}
      >
        <Card className="assignment-list">
          {loading ? (
            <EmptyState title="Loading assignments" body="Loading your saved workspace…" />
          ) : filtered.length ? (
            filtered.map((assignment) => {
              const course = courses.find((item) => item.id === assignment.courseId);
              return (
                <button
                  className={`assignment-row ${selected?.id === assignment.id ? "selected" : ""}`}
                  key={assignment.id}
                  onClick={() => selectAssignment(assignment.id)}
                >
                  <i
                    className={`course-line ${courseToneClass(course?.id ?? assignment.courseId)}`}
                  />
                  <div>
                    <div className="assignment-row-top">
                      <h3>{assignment.title}</h3>
                      {assignment.missing && <Badge tone="danger">MISSING</Badge>}
                      {assignment.late && <Badge tone="warning">LATE</Badge>}
                      {assignment.locked && <Badge tone="neutral">LOCKED</Badge>}
                      {assignment.excused && <Badge tone="success">EXCUSED</Badge>}
                      {assignment.submissionStatus === "submitted" && (
                        <Badge tone="success">SUBMITTED</Badge>
                      )}
                      {assignment.submissionStatus === "graded" && (
                        <Badge tone="success">GRADED</Badge>
                      )}
                      {assignment.completionState === "completed" && (
                        <Badge tone="success">COMPLETED</Badge>
                      )}
                      {!backendMode && (
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
                      )}
                    </div>
                    <p>
                      <span>{course?.name ?? "Unknown course"}</span>
                      <span>{assignmentDate(assignment.dueAt, backendMode)}</span>
                      {backendMode ? (
                        <span>{assignment.type.replaceAll("_", " ")}</span>
                      ) : (
                        <>
                          <span>{assignment.estimatedMinutes} min</span>
                          <span>
                            {assignment.scheduledSessionIds.length
                              ? `${assignment.scheduledSessionIds.length} session`
                              : "Not scheduled"}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  {!backendMode && (
                    <span className={`priority-score ${assignment.priority}`}>
                      {assignment.analysis.priorityScore}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <EmptyState
              title={
                backendMode && !assignments.length
                  ? "No Canvas assignments yet"
                  : "No assignments match"
              }
              body={
                backendMode && !assignments.length
                  ? "Verify and sync Canvas from Settings. Empty courses and summer terms are handled without creating fake work."
                  : "Try a different tab, search, or filter. Your assignments have not been changed."
              }
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
                      late: "",
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
                {backendMode ? (
                  <Badge tone="neutral">{selected.type.replaceAll("_", " ").toUpperCase()}</Badge>
                ) : (
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
                )}
              </div>
              <h2>{selected.title}</h2>
              <p className="detail-description">{selected.description}</p>
              <div className="detail-facts">
                <div className="detail-fact">
                  <small>Due</small>
                  <strong>{assignmentDate(selected.dueAt, backendMode)}</strong>
                </div>
                <div className="detail-fact">
                  <small>Points / weight</small>
                  <strong>
                    {selected.points} pts{selected.gradeWeight ? ` · ${selected.gradeWeight}%` : ""}
                  </strong>
                </div>
                {!backendMode && (
                  <>
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
                  </>
                )}
                <div className="detail-fact">
                  <small>Submission</small>
                  <strong>{selected.submissionStatus.replaceAll("_", " ")}</strong>
                </div>
                {backendMode ? (
                  <div className="detail-fact">
                    <small>Grade</small>
                    <strong>
                      {selected.grade ??
                        (selected.score === undefined ? "Not graded" : selected.score)}
                    </strong>
                  </div>
                ) : (
                  <div className="detail-fact">
                    <small>Priority score</small>
                    <strong>{selected.analysis.priorityScore}/100</strong>
                  </div>
                )}
              </div>
              <div className="canvai-callout">
                {backendMode ? <Check /> : <SparkleIcon />}
                <span>
                  {backendMode ? "Deterministic classification: " : ""}
                  {selected.analysis.explanation}
                </span>
              </div>
              {selected.source !== "canvas" && (
                <>
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
                                {formatDate(session.startAt)} · {session.durationMinutes} min
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
                </>
              )}
              <div className="detail-actions">
                {selected.source !== "canvas" && (
                  <>
                    <Button
                      variant="primary"
                      icon={
                        selected.completionState === "completed" ? <ArrowClockwise /> : <Check />
                      }
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
                    <Button icon={<CalendarPlus />} onClick={() => addSession(selected.id)}>
                      {selectedSessions.length ? "Reschedule" : "Schedule"}
                    </Button>
                    <Button icon={<Plus />} onClick={() => addSession(selected.id)}>
                      Add study block
                    </Button>
                  </>
                )}
                {selected.canvasUrl && (
                  <a
                    className="button button-secondary"
                    href={selected.canvasUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <LinkIcon /> Open in Canvas
                  </a>
                )}
                {selected.source !== "canvas" && (
                  <Button
                    icon={<ArrowClockwise />}
                    onClick={() => showToast("Canvai prepared a local reschedule preview")}
                  >
                    Plan with Canvai
                  </Button>
                )}
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
        description="The deterministic planner will use this estimate in future schedule drafts."
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

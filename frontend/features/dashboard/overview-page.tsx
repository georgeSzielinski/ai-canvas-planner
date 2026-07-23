"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowClockwise,
  ArrowRight,
  Barbell,
  Bell,
  Boat,
  CalendarBlank,
  CalendarCheck,
  CalendarDots,
  Car,
  Clock,
  ClockCountdown,
  Fire,
  ForkKnife,
  GraduationCap,
  HourglassMedium,
  MoonStars,
  Plus,
  Sparkle,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Modal,
  SectionHeader,
} from "@/components/common/ui";
import { ManualAssignmentModal } from "@/components/assignments/manual-assignment-modal";
import { useApp } from "@/components/common/app-provider";
import { useAuth } from "@/components/auth/auth-provider";

import { courseToneClass } from "@/lib/course-style";
import { DEMO_REFERENCE_DATE, demoLongDate, formatDemoDate } from "@/lib/demo-date";
import {
  selectHighestPriority,
  selectMissingWork,
  selectUpcomingAssignments,
} from "@/lib/selectors";
import { services } from "@/services";

const agenda = [
  {
    time: "8:30 AM",
    label: "School",
    sub: "Homeroom → Period 7",
    icon: GraduationCap,
    tone: "fixed",
  },
  { time: "3:30 PM", label: "Commute home", sub: "about 1 hour", icon: Car, tone: "fixed" },
  {
    time: "4:30 PM",
    label: "Rowing practice",
    sub: "Erg + water · 2h 30m",
    icon: Boat,
    tone: "training",
  },
  {
    time: "7:30 PM",
    label: "Optional lifting",
    sub: "Recovery-aware · 15 min",
    icon: Barbell,
    tone: "training",
  },
  { time: "8:00 PM", label: "Dinner", sub: "30 minutes", icon: ForkKnife, tone: "fixed" },
  {
    time: "8:30 PM",
    label: "AP Seminar — Source analysis",
    sub: "45 min focus block",
    icon: Sparkle,
    tone: "study",
  },
  {
    time: "9:25 PM",
    label: "Physics — Test preparation",
    sub: "45 min focus block",
    icon: Sparkle,
    tone: "study",
  },
  {
    time: "10:30 PM",
    label: "Wind down & sleep",
    sub: "Protected until 6:30 AM",
    icon: MoonStars,
    tone: "guardrail",
  },
];

const changes = [
  ["New assignment detected", "Business presentation imported", "12m"],
  ["Due date changed", "English essay moved to Friday", "1h"],
  ["Study session moved", "Physics prep shifted after rowing", "2h"],
  ["Missing work detected", "World History reflection", "5h"],
  ["Conflict resolved", "Dinner no longer overlaps study", "8h"],
];

export function OverviewPage() {
  const { user } = useAuth();
  const {
    backendMode,
    loading,
    calendarConnection,
    assignments,
    courses,
    sessions,
    notifications,
    workload: weeklyWorkload,
    settings,
    showToast,
    setProposal,
    proposal,
    applyProposal,
  } = useApp();
  const [manualOpen, setManualOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const requestProposal = async (command: string) => {
    setProcessing(true);
    setProposalOpen(true);
    try {
      const next = await services.canvai.proposeScheduleChange(command);
      setProposal(next);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Canvai could not prepare a preview.");
      setProposalOpen(false);
    } finally {
      setProcessing(false);
    }
  };
  const simulate = (message: string) => showToast(`${message} — simulated in demo mode`);

  if (loading) return <LoadingState label="Loading your workspace" />;
  if (!assignments.length || !courses.length) {
    return (
      <EmptyState
        title="Your workspace is ready"
        body={
          backendMode
            ? "No Canvas assignments are available yet. Connect and synchronize Canvas in Settings."
            : "No assignments are available in this demo workspace."
        }
      />
    );
  }
  const referenceDate = backendMode ? new Date().toISOString() : DEMO_REFERENCE_DATE;
  const upcoming = selectUpcomingAssignments(assignments, 2, referenceDate);
  const highest = selectHighestPriority(assignments);
  const course = courses.find((item) => item.id === highest.courseId);
  if (!course) {
    return (
      <EmptyState title="Course data unavailable" body="Reload the workspace and try again." />
    );
  }

  const missing = selectMissingWork(assignments);
  const plannedMinutes = sessions.reduce((total, session) => total + session.durationMinutes, 0);
  const nextSession = [...sessions].sort(
    (left, right) => +new Date(left.startAt) - +new Date(right.startAt),
  )[0];
  const displayChanges = backendMode
    ? notifications.map((item) => [item.title, item.body, item.timeLabel] as const)
    : changes;
  const displayAgenda = backendMode
    ? sessions.map((session) => ({
        time: new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(session.startAt)),
        label: session.title,
        sub: `${session.durationMinutes} min study session`,
        icon: Sparkle,
        tone: "study",
      }))
    : agenda;

  const metrics = [
    {
      label: "Due within 48 hours",
      value: String(upcoming.length),
      unit: `assignments · ${upcoming.filter((item) => ["urgent", "high"].includes(item.priority)).length} high priority`,
      icon: ClockCountdown,
      tone: "orange",
    },
    {
      label: "Planned study today",
      value: `${Math.floor(plannedMinutes / 60)}h ${plannedMinutes % 60}m`,
      unit: `${sessions.length} planned focus session${sessions.length === 1 ? "" : "s"}`,
      icon: Clock,
      tone: "study",
    },
    {
      label: "Highest priority",
      value: highest.title,
      unit: `priority ${highest.analysis.priorityScore} · ${formatDemoDate(highest.dueAt)}`,
      icon: Fire,
      tone: "red",
    },
    {
      label: "Next study session",
      value: nextSession
        ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
            new Date(nextSession.startAt),
          )
        : "Not planned",
      unit: nextSession?.title ?? "No study sessions available",
      icon: CalendarCheck,
      tone: "accent",
    },
    {
      label: "Overdue or missing",
      value: String(missing.length),
      unit: missing[0]?.title ?? "No missing work",
      icon: WarningCircle,
      tone: "red",
    },
  ];

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Good afternoon, {user?.display_name ?? settings.profile.displayName}.</h1>
          <p>
            <CalendarBlank style={{ verticalAlign: "-2px", marginRight: 5 }} />
            {backendMode
              ? new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())
              : demoLongDate}{" "}
            · {backendMode ? "Private workspace" : "Demo workspace"} ·{" "}
            {backendMode
              ? calendarConnection?.connected
                ? "Google Calendar connected"
                : "Google Calendar not connected"
              : "Canvas demo data"}
          </p>
        </div>
        <div className="page-actions">
          <Button icon={<ArrowClockwise />} onClick={() => requestProposal("Rebuild the week")}>
            Rebuild week
          </Button>
          {!backendMode && (
            <Button variant="primary" icon={<Plus />} onClick={() => setManualOpen(true)}>
              Quick add
            </Button>
          )}
        </div>
      </div>
      <div className="overview-metrics">
        {metrics.map(({ label, value, unit, icon: Icon, tone }) => (
          <Card className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className={`metric-icon ${tone}`}>
                <Icon />
              </span>
            </div>
            <div>
              <div className="metric-value">{value}</div>
              <div className="metric-unit">{unit}</div>
            </div>
          </Card>
        ))}
      </div>
      <div className="overview-columns">
        <div className="stack">
          <Card className="focus-card">
            <SectionHeader
              title="Primary focus"
              eyebrow="What to do next"
              aside={<Badge tone="danger">Priority {highest.analysis.priorityScore}</Badge>}
            />
            <div className="focus-hero">
              <div className="assignment-kicker">
                <span className={`course-chip ${courseToneClass(course.id)}`}>
                  <i />
                  {course.name}
                </span>
                <Badge tone="warning">{highest.priority.toUpperCase()}</Badge>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {highest.type}
                </span>
              </div>
              <h3>{highest.title}</h3>
              <div className="assignment-meta">
                <span>
                  <Clock />
                  {formatDemoDate(highest.dueAt)}
                </span>
                <span>
                  <HourglassMedium />
                  {highest.estimatedMinutes} minutes
                </span>
                <span>{highest.points} points</span>
              </div>
              <div className="canvai-callout focus-reason">
                <Sparkle weight="fill" />
                <span>
                  <strong>Why this is first:</strong> {highest.analysis.explanation}
                </span>
              </div>
              <div className="focus-actions">
                <Link
                  href={`/assignments?assignment=${highest.id}`}
                  className="button button-primary"
                >
                  Open assignment <ArrowRight />
                </Link>
                <Button
                  icon={<ArrowClockwise />}
                  onClick={() => requestProposal("Prepare for the Physics test")}
                >
                  Plan or reschedule
                </Button>
              </div>
            </div>
          </Card>
          <Card className="workload-card">
            <div className="spread">
              <div>
                <div className="eyebrow">Workload outlook</div>
                <h2 style={{ margin: 0, fontSize: 15.5 }}>Next seven days</h2>
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>
                Bars: planned · dashed: capacity
              </span>
            </div>
            <div className="workload-chart" aria-label="Seven day planned workload chart">
              {weeklyWorkload.map((day, index) => {
                const percent = Math.min(100, (day.plannedMinutes / 180) * 100);
                const capacity = Math.min(96, 100 - (day.capacityMinutes / 180) * 100);
                const over = day.plannedMinutes > day.capacityMinutes;
                return (
                  <div
                    className="workload-day"
                    key={day.day}
                    title={`${day.plannedMinutes} planned minutes, ${day.capacityMinutes} capacity${day.tests ? ", test day" : ""}${day.writingHeavy ? ", writing heavy" : ""}`}
                  >
                    <strong>{day.plannedMinutes / 60}h</strong>
                    <div className={`workload-track ${index === 2 ? "today" : ""}`}>
                      <i className="workload-capacity" style={{ top: `${capacity}%` }} />
                      <i
                        className={`workload-bar ${over ? "over" : ""}`}
                        style={{ height: `${percent}%` }}
                      />
                    </div>
                    <span className={index === 2 ? "today" : ""}>{day.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="warning-callout">
              <Warning weight="fill" />
              <span>
                <strong>Sunday is overloaded.</strong> A test and two writing-heavy periods drive
                deadline pressure above available capacity.
              </span>
            </div>
          </Card>
          <Card>
            <SectionHeader
              title="Recent changes"
              aside={<Badge>{displayChanges.length} updates</Badge>}
            />
            <div className="changes-list" style={{ padding: 14 }}>
              {displayChanges.map(([title, detail, time]) => (
                <div className="change-item" key={title}>
                  <Bell />
                  <div>
                    <strong>{title}</strong>
                    <p>
                      {detail} · {time} ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card className="timeline-card">
            <div className="spread">
              <h2 style={{ margin: 0, fontSize: 15.5 }}>Today’s agenda</h2>
              <span className="muted" style={{ fontSize: 11.5 }}>
                Preview only
              </span>
            </div>
            <div className="timeline">
              {displayAgenda.map(({ time, label, sub, icon: Icon, tone }) => (
                <div className="timeline-item" key={`${time}-${label}`}>
                  <time>{time}</time>
                  <span className={`timeline-icon ${tone}`}>
                    <Icon weight={tone === "study" ? "fill" : "regular"} />
                  </span>
                  <div>
                    <h3>{label}</h3>
                    <p>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="agenda-actions">
              <Button onClick={() => simulate("Opening Google Calendar")}>
                Open in Google Calendar
              </Button>
              <Button onClick={() => simulate("Study plan previewed")}>Preview study plan</Button>
              <Button variant="primary" onClick={() => simulate("Publish plan")}>
                Publish plan
              </Button>
            </div>
          </Card>
          <Card className="canvai-card">
            <div className="canvai-card-header">
              <span>
                <Sparkle weight="fill" />
              </span>
              <div>
                <strong>Canvai insight</strong>
                <small>Weekly briefing · plan ready</small>
              </div>
            </div>
            <p>
              You have two writing-heavy assignments this week. Starting the English essay tonight
              will keep Sunday lighter.
            </p>
            <div className="chip-actions">
              {[
                "Make tonight lighter",
                "Keep Sunday light",
                "Protect sleep",
                "Find time for lifting",
              ].map((command) => (
                <button
                  className="chip-button"
                  onClick={() => requestProposal(command)}
                  key={command}
                >
                  {command}
                </button>
              ))}
            </div>
          </Card>
          <Card className="card-padded">
            <div className="eyebrow">Quick actions</div>
            <div className="quick-actions-grid">
              {[
                ...(!backendMode
                  ? [
                      [
                        Plus,
                        "Add manual assignment",
                        "Create work Canvas does not contain",
                        () => setManualOpen(true),
                      ],
                    ]
                  : []),
                [
                  MoonStars,
                  "Make tonight lighter",
                  "Move one session without losing progress",
                  () => requestProposal("Make tonight lighter"),
                ],
                [
                  ArrowClockwise,
                  "Rebuild week",
                  "Rebalance around current deadlines",
                  () => requestProposal("Rebuild the week"),
                ],
                [
                  MoonStars,
                  "Protect sleep",
                  "Lock a 10:15 PM study cutoff",
                  () => requestProposal("Protect sleep"),
                ],
                [
                  Barbell,
                  "Find time for lifting",
                  "Reserve an athlete-aware block",
                  () => requestProposal("Find time for lifting"),
                ],
                [
                  CalendarDots,
                  "Open Google Calendar",
                  backendMode ? "Open your primary calendar UI" : "Preview-only in Phase 1",
                  () =>
                    backendMode
                      ? window.open(
                          "https://calendar.google.com/calendar/u/0/r",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      : simulate("Opening Google Calendar"),
                ],
              ].map(([Icon, title, body, action]) => {
                const I = Icon as typeof Plus;
                return (
                  <button
                    className="quick-action"
                    key={title as string}
                    onClick={action as () => void}
                  >
                    <I />
                    <span>
                      <strong>{title as string}</strong>
                      <small>{body as string}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
      {!backendMode && (
        <ManualAssignmentModal open={manualOpen} onClose={() => setManualOpen(false)} />
      )}
      <Modal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        title="Canvai plan preview"
        description="Nothing changes until you apply this preview."
      >
        {processing ? (
          <div className="proposal-processing">
            <span className="analysis-orbit">
              <Sparkle />
            </span>
            <strong>Canvai is balancing your week…</strong>
          </div>
        ) : (
          proposal && (
            <div>
              <h3 style={{ marginTop: 0 }}>{proposal.summary}</h3>
              <p className="muted">{proposal.reasoning}</p>
              {proposal.changes.map((change) => (
                <div className="proposal-change" key={change.id}>
                  <span>
                    <ArrowClockwise />
                  </span>
                  <div>
                    <h3>{change.label}</h3>
                    <p>
                      {change.before && `${change.before} → `}
                      {change.after}
                    </p>
                  </div>
                </div>
              ))}
              <div className="form-actions">
                <Button
                  onClick={() => showToast("Proposal editing is available as a local preview")}
                >
                  Edit
                </Button>
                <Button onClick={() => setProposalOpen(false)}>Dismiss</Button>
                {backendMode ? (
                  <Button variant="primary" onClick={() => setProposalOpen(false)}>
                    Close preview
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => {
                      applyProposal();
                      setProposalOpen(false);
                    }}
                  >
                    Apply changes
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}

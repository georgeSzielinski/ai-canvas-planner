"use client";

import Link from "next/link";
import {
  CalendarBlank,
  CalendarCheck,
  Clock,
  Fire,
  GraduationCap,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/auth-provider";
import { useApp } from "@/components/common/app-provider";
import { Badge, Card, EmptyState, LoadingState, SectionHeader } from "@/components/common/ui";
import { formatDate } from "@/lib/date";
import {
  selectHighestPriority,
  selectMissingWork,
  selectUpcomingAssignments,
} from "@/lib/selectors";

const minutesLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

export function OverviewPage() {
  const { user } = useAuth();
  const {
    loading,
    calendarConnection,
    canvasConnection,
    assignments,
    courses,
    sessions,
    notifications,
  } = useApp();

  if (loading) return <LoadingState label="Loading your workspace" />;

  if (!courses.length || !assignments.length) {
    return (
      <EmptyState
        title="Your workspace is ready"
        body="No Canvas assignments are available yet. Connect and synchronize Canvas in Settings."
        action={
          <Link className="button button-primary" href="/settings">
            Configure connections
          </Link>
        }
      />
    );
  }

  const activeAssignments = assignments.filter(
    (assignment) =>
      assignment.completionState !== "completed" &&
      assignment.submissionStatus !== "submitted" &&
      assignment.submissionStatus !== "graded",
  );
  if (!activeAssignments.length) {
    return (
      <EmptyState
        title="You’re all caught up"
        body="Canvas is connected and every imported assignment is complete. New open work will appear after the next sync."
      />
    );
  }

  const now = new Date();
  const reference = now.toISOString();
  const upcoming = selectUpcomingAssignments(activeAssignments, 7, reference);
  const missing = selectMissingWork(activeAssignments);
  const highest = selectHighestPriority(activeAssignments);
  const today = now.toDateString();
  const studyTodayMinutes = sessions
    .filter((session) => new Date(session.startAt).toDateString() === today)
    .reduce((total, session) => total + session.durationMinutes, 0);
  const nextSession = sessions
    .filter((session) => new Date(session.startAt).getTime() >= now.getTime())
    .sort((left, right) => +new Date(left.startAt) - +new Date(right.startAt))[0];

  return (
    <div className="stack-page">
      <section className="overview-hero">
        <div>
          <span className="eyebrow">Real workspace</span>
          <h1>Welcome back, {user?.display_name ?? "student"}</h1>
          <p>
            <CalendarBlank aria-hidden="true" />{" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(now)}
          </p>
        </div>
        <div className="row">
          <Badge tone={canvasConnection?.connected ? "success" : "warning"}>
            Canvas {canvasConnection?.connected ? "connected" : "disconnected"}
          </Badge>
          <Badge tone={calendarConnection?.connected ? "success" : "warning"}>
            Calendar {calendarConnection?.connected ? "connected" : "disconnected"}
          </Badge>
        </div>
      </section>

      <section className="metric-grid" aria-label="Current workload">
        <Card className="metric-card">
          <GraduationCap aria-hidden="true" />
          <span>Due in seven days</span>
          <strong>{upcoming.length}</strong>
        </Card>
        <Card className="metric-card">
          <WarningCircle aria-hidden="true" />
          <span>Missing</span>
          <strong>{missing.length}</strong>
        </Card>
        <Card className="metric-card">
          <CalendarCheck aria-hidden="true" />
          <span>Study scheduled today</span>
          <strong>{minutesLabel(studyTodayMinutes)}</strong>
        </Card>
        <Card className="metric-card">
          <Fire aria-hidden="true" />
          <span>Highest priority</span>
          <strong>{highest?.title ?? "None"}</strong>
        </Card>
      </section>

      <div className="overview-grid">
        <Card>
          <SectionHeader title="Next study session" />
          {nextSession ? (
            <div className="assignment-row">
              <Clock aria-hidden="true" />
              <div>
                <strong>{nextSession.title}</strong>
                <p>
                  {formatDate(nextSession.startAt)} · {minutesLabel(nextSession.durationMinutes)}
                </p>
              </div>
            </div>
          ) : (
            <p className="muted">No real study session is currently scheduled.</p>
          )}
        </Card>
        <Card>
          <SectionHeader title="Planning status" />
          <p className="muted">
            {calendarConnection?.connected
              ? "Calendar availability is ready for planning."
              : "Connect Google Calendar before generating a schedule draft."}
          </p>
          <Link className="button" href="/canvai">
            Open planning
          </Link>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Recent real changes" />
        {notifications.length ? (
          <ul className="plain-list">
            {notifications.slice(0, 5).map((notification) => (
              <li key={notification.id}>
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No provider or planning changes have been recorded.</p>
        )}
      </Card>
    </div>
  );
}

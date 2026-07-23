import type { Page, Route } from "@playwright/test";
import {
  assignments as fixtureAssignments,
  courses,
  defaultSettings,
  insightMetrics,
  notifications,
  routineBlocks,
  studySessions,
  weeklyWorkload,
} from "@/lib/demo-data";
import { settingsToWire } from "@/services/settings-service";

const user = {
  id: "user-e2e",
  email: "maya@example.test",
  display_name: "Maya Kessler",
  profile_photo: null,
  timezone: "America/Los_Angeles",
  onboarding_complete: true,
  preferred_theme: "system",
  school_year: "Junior",
  week_starts_on: "monday",
  bedtime: "22:30",
  wake_time: "06:30",
  rowing_schedule: [],
  default_study_duration: 45,
  preferred_calendar: null,
  calendar_consent: true,
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
};

const canvasConnection = {
  connected: true,
  configured: true,
  status: "connected",
  canvas_display_name: "Maya Canvas",
  canvas_user_id: "42",
  hostname: "sequoia.instructure.com",
  last_verified_at: "2026-07-22T16:00:00Z",
  last_successful_sync_at: "2026-07-22T16:01:00Z",
  last_attempted_sync_at: "2026-07-22T16:01:00Z",
  last_sync_status: "success",
  last_error_code: null,
  include_concluded_courses: false,
  data_stale: false,
};

const canvasCourse = {
  id: "canvas-course-e2e",
  canvas_course_id: "71",
  name: "Biology",
  course_code: "BIO",
  enrollment_state: "active",
  workflow_state: "available",
  term_name: "Summer",
  start_at: null,
  end_at: null,
  concluded: false,
  favorite: true,
  selected_for_sync: true,
  archived: false,
  assignment_count: 1,
  last_seen_at: "2026-07-22T16:01:00Z",
};

const canvasAssignment = {
  id: "canvas-assignment-e2e",
  canvas_assignment_id: "99",
  course_id: canvasCourse.id,
  course_name: canvasCourse.name,
  title: "Field Lab",
  description: "Observe and report.",
  category: "lab",
  category_reason: "Matched lab in the assignment title.",
  canvas_url: "https://sequoia.instructure.com/courses/71/assignments/99",
  due_at: null,
  unlock_at: null,
  lock_at: null,
  points_possible: 12.5,
  submission_types: ["online_upload"],
  assignment_group: "4",
  grading_type: "points",
  published: true,
  omitted_from_final_grade: false,
  peer_reviews: false,
  workflow_state: "unsubmitted",
  submission_status: "not_started",
  submitted_at: null,
  graded_at: null,
  score: null,
  grade: null,
  late: true,
  missing: true,
  excused: false,
  attempt_count: 0,
  seconds_late: 30,
  completed: false,
  locked: false,
  archived: false,
  concluded_course: false,
  canvas_created_at: "2026-07-01T00:00:00Z",
  canvas_updated_at: "2026-07-22T00:00:00Z",
  first_seen_at: "2026-07-22T16:01:00Z",
  last_seen_at: "2026-07-22T16:01:00Z",
};

const canvasSyncReport = {
  id: "canvas-sync-e2e",
  status: "success",
  courses_checked: 1,
  courses_imported: 1,
  assignments_created: 1,
  assignments_updated: 0,
  assignments_unchanged: 0,
  assignments_archived: 0,
  submission_states_updated: 1,
  course_failures: 0,
  warnings: [],
  started_at: "2026-07-22T16:00:00Z",
  completed_at: "2026-07-22T16:01:00Z",
  error_code: null,
};

function settingsWire(settings = defaultSettings) {
  return settingsToWire(settings) as Record<string, unknown>;
}

function courseWire(course: (typeof courses)[number]) {
  return {
    id: course.id,
    name: course.name,
    short_name: course.shortName,
    color: course.color,
  };
}

function assignmentWire(assignment: (typeof fixtureAssignments)[number]) {
  return {
    id: assignment.id,
    course_id: assignment.courseId,
    title: assignment.title,
    description: assignment.description,
    type: assignment.type,
    due_at: assignment.dueAt,
    points: assignment.points,
    grade_weight: assignment.gradeWeight ?? null,
    estimated_minutes: assignment.estimatedMinutes,
    actual_minutes: assignment.actualMinutes ?? null,
    priority: assignment.priority,
    submission_status: assignment.submissionStatus,
    missing: assignment.missing,
    completion_state: assignment.completionState,
    scheduled_session_ids: assignment.scheduledSessionIds,
    analysis: {
      difficulty: assignment.analysis.difficulty,
      urgency: assignment.analysis.urgency,
      priority_score: assignment.analysis.priorityScore,
      explanation: assignment.analysis.explanation,
      suggested_steps: assignment.analysis.suggestedSteps,
    },
    canvas_url: assignment.canvasUrl,
  };
}

function sessionWire(session: (typeof studySessions)[number]) {
  return {
    id: session.id,
    assignment_id: session.assignmentId,
    title: session.title,
    start_at: session.startAt,
    duration_minutes: session.durationMinutes,
    status: session.status,
    source: session.source,
  };
}

export async function installAuthenticatedSession(page: Page) {
  let assignmentState = fixtureAssignments.map((item) => ({ ...item }));
  let currentSettings = settingsWire();

  await page.route("http://api.example.test/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      if (request.headers()["x-csrf-token"] !== "e2e-csrf") {
        await route.fulfill({ status: 403, json: { detail: "CSRF validation failed" } });
        return;
      }
    }

    if (path === "/api/v1/auth/session") {
      await route.fulfill({
        json: {
          authenticated: true,
          expires_at: "2026-08-20T00:00:00Z",
          csrf_token: "e2e-csrf",
          reauthentication_required: false,
        },
      });
      return;
    }
    if (path === "/api/v1/auth/me") {
      await route.fulfill({ json: user });
      return;
    }
    if (path === "/api/v1/workspace/bootstrap") {
      await route.fulfill({
        json: {
          courses: courses.map(courseWire),
          assignments: assignmentState.map(assignmentWire),
          sessions: studySessions.map(sessionWire),
          routine: routineBlocks.map((item) => ({
            id: item.id,
            day: item.day,
            activity: item.activity,
            start_time: item.startTime,
            end_time: item.endTime,
            color: item.color,
          })),
          workload: weeklyWorkload.map((item) => ({
            date: item.date,
            day: item.day,
            planned_minutes: item.plannedMinutes,
            capacity_minutes: item.capacityMinutes,
            deadline_pressure: item.deadlinePressure,
            tests: item.tests,
            writing_heavy: item.writingHeavy,
          })),
          settings: currentSettings,
          notifications: notifications.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            time_label: item.timeLabel,
            kind: item.kind,
            read: item.read,
          })),
        },
      });
      return;
    }
    if (path === "/api/v1/calendar/status") {
      await route.fulfill({
        json: {
          connected: false,
          status: "not_connected",
          provider_email: null,
          permissions: [],
          last_sync_at: null,
          last_error: null,
          reauthentication_required: false,
        },
      });
      return;
    }
    if (path === "/api/v1/canvas/status") {
      await route.fulfill({ json: canvasConnection });
      return;
    }
    if (path === "/api/v1/canvas/verify" && method === "POST") {
      await route.fulfill({ json: canvasConnection });
      return;
    }
    if (path === "/api/v1/canvas/sync" && method === "POST") {
      await route.fulfill({ json: canvasSyncReport });
      return;
    }
    if (path === "/api/v1/canvas/sync/latest") {
      await route.fulfill({ json: canvasSyncReport });
      return;
    }
    if (path === "/api/v1/canvas/courses") {
      await route.fulfill({ json: [canvasCourse] });
      return;
    }
    if (path === `/api/v1/canvas/courses/${canvasCourse.id}` && method === "PATCH") {
      await route.fulfill({
        json: {
          ...canvasCourse,
          selected_for_sync: request.postDataJSON().selected_for_sync,
        },
      });
      return;
    }
    if (path === "/api/v1/canvas/assignments") {
      await route.fulfill({
        json: { items: [canvasAssignment], page: 1, page_size: 100, total: 1 },
      });
      return;
    }
    if (path === "/api/v1/insights") {
      await route.fulfill({ json: insightMetrics });
      return;
    }
    if (path === "/api/v1/settings" && method === "PATCH") {
      currentSettings = request.postDataJSON();
      await route.fulfill({ json: currentSettings });
      return;
    }
    if (path.startsWith("/api/v1/assignments/") && method === "PATCH") {
      const id = decodeURIComponent(path.split("/").at(-1) ?? "");
      const patch = request.postDataJSON();
      assignmentState = assignmentState.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(patch.status ? { status: patch.status } : {}),
              ...(patch.completion_state ? { completionState: patch.completion_state } : {}),
              ...(typeof patch.estimated_minutes === "number"
                ? { estimatedMinutes: patch.estimated_minutes }
                : {}),
              ...(patch.priority ? { priority: patch.priority } : {}),
            }
          : item,
      );
      const updated = assignmentState.find((item) => item.id === id);
      await route.fulfill({
        status: updated ? 200 : 404,
        json: updated ? assignmentWire(updated) : {},
      });
      return;
    }
    if (path === "/api/v1/canvai/proposals" && method === "POST") {
      await route.fulfill({
        json: {
          id: "proposal-e2e",
          command: request.postDataJSON().command,
          summary: "Backend preview generated from the authenticated workspace.",
          reasoning: "Protect the study cutoff while keeping high-priority work visible.",
          changes: [],
          status: "preview",
        },
      });
      return;
    }
    if (path === "/api/v1/notifications") {
      await route.fulfill({
        json: notifications.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          time_label: item.timeLabel,
          kind: item.kind,
          read: item.read,
        })),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      json: { detail: `Unhandled E2E API route: ${method} ${path}` },
    });
  });
}

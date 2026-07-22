import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { assignments, courses, defaultSettings, studySessions } from "@/lib/demo-data";
import { AssignmentsPage } from "@/features/assignments/assignments-page";

const { previewStudySession, publishStudySession } = vi.hoisted(() => ({
  previewStudySession: vi.fn(),
  publishStudySession: vi.fn(),
}));

vi.mock("@/services/calendar-service", () => ({
  calendarService: { previewStudySession, publishStudySession },
}));

vi.mock("@/components/common/app-provider", () => ({
  useApp: () => ({
    backendMode: true,
    calendarConnection: { connected: true, status: "connected" },
    courses,
    loading: false,
    assignments,
    sessions: studySessions,
    settings: defaultSettings,
    updateAssignment: vi.fn(),
    addSession: vi.fn(),
    removeSession: vi.fn(),
    showToast: vi.fn(),
  }),
}));

it("previews and explicitly confirms a manual Calendar publication", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AssignmentsPage />);

  const assignment = assignments.find((item) => item.scheduledSessionIds.length > 0);
  const session = studySessions.find((item) => assignment?.scheduledSessionIds.includes(item.id));
  expect(assignment).toBeDefined();
  expect(session).toBeDefined();
  previewStudySession.mockResolvedValue({
    session_id: session!.id,
    calendar_id: "study-calendar",
    title: session!.title,
    starts_at: session!.startAt,
    ends_at: "2026-09-16T21:00:00-07:00",
    reminder_minutes: 10,
    description: "Study session",
    confirmation_token: "confirm-once",
  });
  publishStudySession.mockResolvedValue({
    session_id: session!.id,
    calendar_id: "study-calendar",
    provider_event_id: "event-1",
    action: "created",
    published_at: "2026-09-16T19:00:00-07:00",
  });
  await user.click(screen.getByRole("button", { name: new RegExp(assignment!.title) }));
  await user.click(
    screen.getByRole("button", { name: `Publish ${session!.title} to Google Calendar` }),
  );

  expect(previewStudySession).toHaveBeenCalledWith(session!.id);
  expect(window.confirm).toHaveBeenCalledOnce();
  expect(publishStudySession).toHaveBeenCalledWith(session!.id, "confirm-once");
});

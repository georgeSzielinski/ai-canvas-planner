import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AssignmentsPage } from "@/features/assignments/assignments-page";

vi.mock("@/components/common/app-provider", () => ({
  useApp: () => ({
    backendMode: true,
    calendarConnection: null,
    canvasConnection: {
      connected: true,
      status: "connected",
      data_stale: true,
    },
    canvasSyncReport: {
      status: "partial",
      course_failures: 1,
    },
    canvasLoading: false,
    canvasError: "Canvas data could not be refreshed. Previously loaded data was preserved.",
    refreshCanvasWorkspace: vi.fn(),
    courses: [
      {
        id: "course-1",
        name: "Biology",
        shortName: "BIO",
        color: "accent",
        concluded: false,
      },
    ],
    loading: false,
    assignments: [
      {
        id: "assignment-missing",
        courseId: "course-1",
        title: "Field Lab",
        description: "Observe and report.",
        type: "lab",
        dueAt: null,
        points: 12.5,
        estimatedMinutes: 0,
        priority: "low",
        submissionStatus: "not_started",
        missing: true,
        late: true,
        locked: true,
        completionState: "open",
        scheduledSessionIds: [],
        analysis: {
          difficulty: 1,
          urgency: 1,
          priorityScore: 0,
          explanation: "Matched lab in the assignment title.",
          suggestedSteps: [],
        },
        canvasUrl: "https://sequoia.instructure.com/courses/1/assignments/9",
        source: "canvas",
      },
      {
        id: "assignment-upcoming",
        courseId: "course-1",
        title: "Upcoming quiz",
        description: "Review.",
        type: "quiz",
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        points: 10,
        estimatedMinutes: 0,
        priority: "low",
        submissionStatus: "not_started",
        missing: false,
        late: false,
        locked: false,
        completionState: "open",
        scheduledSessionIds: [],
        analysis: {
          difficulty: 1,
          urgency: 1,
          priorityScore: 0,
          explanation: "Matched quiz in the assignment title.",
          suggestedSteps: [],
        },
        canvasUrl: "https://sequoia.instructure.com/courses/1/assignments/10",
        source: "canvas",
      },
    ],
    sessions: [],
    updateAssignment: vi.fn(),
    addSession: vi.fn(),
    removeSession: vi.fn(),
    showToast: vi.fn(),
  }),
}));

it("renders real Canvas statuses, no-due work, stale state, and safe external links", async () => {
  const user = userEvent.setup();
  render(<AssignmentsPage />);

  expect(screen.getByRole("alert")).toHaveTextContent(/latest Canvas sync was partial/i);
  expect(screen.getByText(/Previously loaded data was preserved/i)).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Upcoming 1/i })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: /No due date/i }));
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: /Completed/i })).toHaveAttribute("aria-selected", "true");
  await user.click(screen.getByRole("tab", { name: /No due date/i }));
  const row = screen.getByRole("button", { name: /Field Lab/i });
  expect(row).toHaveTextContent("No due date");
  expect(row).toHaveTextContent("MISSING");
  expect(row).toHaveTextContent("LATE");
  expect(row).toHaveTextContent("LOCKED");
  row.focus();
  expect(row).toHaveFocus();

  const link = screen.getByRole("link", { name: /Open in Canvas/i });
  expect(link).toHaveAttribute("href", "https://sequoia.instructure.com/courses/1/assignments/9");
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  expect(screen.queryByRole("button", { name: /Plan with Canvai/i })).not.toBeInTheDocument();
});

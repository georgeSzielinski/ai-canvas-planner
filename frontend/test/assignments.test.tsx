import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, vi } from "vitest";
import { AssignmentsPage, filterAssignments } from "@/features/assignments/assignments-page";
import { assignments, courses, studySessions } from "@/test/fixtures/demo-data";

const { updateAssignment } = vi.hoisted(() => ({ updateAssignment: vi.fn() }));

vi.mock("@/components/common/app-provider", () => ({
  useApp: () => ({
    backendMode: true,
    calendarConnection: null,
    canvasConnection: { connected: true },
    canvasSyncReport: null,
    canvasLoading: false,
    canvasError: null,
    refreshCanvasWorkspace: vi.fn(),
    courses,
    loading: false,
    assignments,
    sessions: studySessions,
    updateAssignment,
    addSession: vi.fn(),
    removeSession: vi.fn(),
    showToast: vi.fn(),
  }),
}));

const noFilters = {
  course: "",
  type: "",
  priority: "",
  completion: "",
  scheduled: "",
  due: "",
  missing: "",
};

describe("assignments", () => {
  it("filters by tab, query, and course", () => {
    expect(
      filterAssignments(assignments, courses, "Gatsby", "all", noFilters).map((item) => item.id),
    ).toEqual(["assignment-english"]);
    expect(filterAssignments(assignments, courses, "", "missing", noFilters)).toHaveLength(1);
    expect(
      filterAssignments(assignments, courses, "", "all", {
        ...noFilters,
        course: "course-physics",
      }),
    ).toHaveLength(1);
  });

  it("searches assignments in the UI", async () => {
    const user = userEvent.setup();
    render(<AssignmentsPage />);
    await user.click(screen.getByRole("tab", { name: /All/ }));
    await user.type(screen.getByPlaceholderText(/Search assignments/i), "Gatsby");
    expect(
      screen.getByRole("button", { name: /Great Gatsby literary essay/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kinematics unit test/i })).not.toBeInTheDocument();
  });

  it("requests an authenticated assignment completion update", async () => {
    const user = userEvent.setup();
    render(<AssignmentsPage />);
    const details = screen.getByRole("heading", { name: "Assignment details" }).closest("section")!;
    await user.click(within(details).getByRole("button", { name: "Mark complete" }));
    expect(updateAssignment).toHaveBeenCalledWith(expect.any(String), {
      completionState: "completed",
      missing: false,
      submissionStatus: "submitted",
    });
  });
});

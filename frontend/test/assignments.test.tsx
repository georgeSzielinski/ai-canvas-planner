import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/components/common/app-provider";
import { ToastRegion } from "@/components/common/ui";
import { AssignmentsPage, filterAssignments } from "@/features/assignments/assignments-page";
import { assignments, courses } from "@/lib/demo-data";

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
    render(
      <AppProvider>
        <AssignmentsPage />
        <ToastRegion />
      </AppProvider>,
    );
    await user.click(screen.getByRole("tab", { name: /All/ }));
    await user.type(screen.getByPlaceholderText(/Search assignments/i), "Gatsby");
    expect(
      screen.getByRole("button", { name: /Great Gatsby literary essay/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kinematics unit test/i })).not.toBeInTheDocument();
  });

  it("changes assignment completion state", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <AssignmentsPage />
        <ToastRegion />
      </AppProvider>,
    );
    const details = screen.getByRole("heading", { name: "Assignment details" }).closest("section")!;
    await user.click(within(details).getByRole("button", { name: "Mark complete" }));
    expect(within(details).getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.getByText("Assignment marked complete")).toBeInTheDocument();
  });
});

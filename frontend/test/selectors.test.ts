import { expect, it } from "vitest";
import { assignments } from "@/lib/demo-data";
import { selectUpcomingAssignments } from "@/lib/selectors";

it("uses the caller's reference time for upcoming assignments", () => {
  const item = {
    ...assignments[0],
    dueAt: "2030-01-02T12:00:00.000Z",
    completionState: "open" as const,
  };

  expect(selectUpcomingAssignments([item], 2, "2030-01-01T12:00:00.000Z")).toEqual([item]);
  expect(selectUpcomingAssignments([item], 2, "2030-02-01T12:00:00.000Z")).toEqual([]);
});

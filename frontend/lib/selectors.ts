import type { Assignment, StudySession, WeeklyWorkload } from "@/types/domain";
import { DEMO_REFERENCE_DATE } from "@/lib/demo-date";

export const selectOverdueAssignments = (
  items: Assignment[],
  referenceDate = DEMO_REFERENCE_DATE,
) => {
  const reference = new Date(referenceDate).getTime();
  return items.filter(
    (item) =>
      item.completionState === "open" &&
      item.dueAt !== null &&
      new Date(item.dueAt).getTime() < reference,
  );
};

export const selectMissingWork = (items: Assignment[]) => items.filter((item) => item.missing);

export const selectUpcomingAssignments = (
  items: Assignment[],
  days = 7,
  referenceDate = DEMO_REFERENCE_DATE,
) => {
  const reference = new Date(referenceDate).getTime();
  return items.filter((item) => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt).getTime();
    return (
      item.completionState === "open" && due >= reference && due <= reference + days * 86_400_000
    );
  });
};

export const selectHighestPriority = (items: Assignment[]) =>
  items
    .filter((item) => item.completionState === "open")
    .sort((a, b) => b.analysis.priorityScore - a.analysis.priorityScore)[0];

export const selectTotalPlannedDuration = (sessions: StudySession[]) =>
  sessions
    .filter((item) => item.status === "planned")
    .reduce((sum, item) => sum + item.durationMinutes, 0);

export const selectScheduleConflicts = (workload: WeeklyWorkload[]) =>
  workload.filter((day) => day.plannedMinutes > day.capacityMinutes);

export const selectCompletionPercentage = (items: Assignment[]) =>
  items.length
    ? Math.round(
        (items.filter((item) => item.completionState === "completed").length / items.length) * 100,
      )
    : 0;

export const selectStudyTimeBySubject = (items: Assignment[]) =>
  items.reduce<Record<string, number>>((totals, item) => {
    totals[item.courseId] =
      (totals[item.courseId] ?? 0) +
      (item.actualMinutes ?? Math.round(item.estimatedMinutes * 0.7));
    return totals;
  }, {});

export const selectWorkloadByDay = (workload: WeeklyWorkload[]) =>
  workload.map((item) => ({
    day: item.day,
    minutes: item.plannedMinutes,
    overloaded: item.plannedMinutes > item.capacityMinutes,
  }));

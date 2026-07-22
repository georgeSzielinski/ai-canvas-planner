import { describe, expect, it } from "vitest";
import { assignmentFromWire, assignmentPatchToWire } from "@/services/assignments-service";

describe("backend assignment wire mapping", () => {
  it("maps snake_case API fields into the frontend domain", () => {
    const assignment = assignmentFromWire({
      id: "assignment-1",
      course_id: "course-1",
      title: "Read chapter",
      description: "Chapter 4",
      type: "reading",
      due_at: "2026-09-18T12:00:00Z",
      points: 10,
      grade_weight: 0.1,
      estimated_minutes: 35,
      actual_minutes: null,
      priority: "high",
      submission_status: "not_started",
      missing: false,
      completion_state: "open",
      scheduled_session_ids: ["session-1"],
      analysis: {
        difficulty: 2,
        urgency: 4,
        priority_score: 81,
        explanation: "Due soon",
        suggested_steps: ["Read"],
      },
      canvas_url: "https://canvas.test/assignment-1",
    });

    expect(assignment.courseId).toBe("course-1");
    expect(assignment.estimatedMinutes).toBe(35);
    expect(assignment.analysis.priorityScore).toBe(81);
    expect(assignment.scheduledSessionIds).toEqual(["session-1"]);
  });

  it("maps editable frontend fields back to the API contract", () => {
    expect(assignmentPatchToWire({ completionState: "completed", estimatedMinutes: 45 })).toEqual({
      completion_state: "completed",
      estimated_minutes: 45,
    });
  });
});

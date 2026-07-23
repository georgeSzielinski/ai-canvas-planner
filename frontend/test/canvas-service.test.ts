import { beforeEach, describe, expect, it, vi } from "vitest";
import { canvasService } from "@/services/canvas-service";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/services/api-client", () => ({
  apiClient: { request },
}));

beforeEach(() => request.mockReset());

describe("canvasService", () => {
  it("maps Canvas courses and assignments without inventing due dates", async () => {
    request
      .mockResolvedValueOnce([
        {
          id: "course-1",
          canvas_course_id: "1",
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
          last_seen_at: "2026-07-22T00:00:00Z",
        },
      ])
      .mockResolvedValueOnce({
        page: 1,
        page_size: 50,
        total: 1,
        items: [
          {
            id: "assignment-1",
            canvas_assignment_id: "9",
            course_id: "course-1",
            course_name: "Biology",
            title: "Lab report",
            description: "Safe text",
            category: "lab",
            category_reason: "Matched lab",
            canvas_url: "https://sequoia.instructure.com/courses/1/assignments/9",
            due_at: null,
            unlock_at: null,
            lock_at: null,
            points_possible: 12.5,
            submission_types: ["online_upload"],
            assignment_group: "2",
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
            missing: false,
            excused: false,
            attempt_count: 0,
            seconds_late: 10,
            completed: false,
            locked: false,
            archived: false,
            concluded_course: false,
            canvas_created_at: null,
            canvas_updated_at: null,
            first_seen_at: "2026-07-22T00:00:00Z",
            last_seen_at: "2026-07-22T00:00:00Z",
          },
        ],
      });

    const [courses, page] = await Promise.all([
      canvasService.getCourses(true),
      canvasService.getAssignments({ no_due_date: true }),
    ]);

    expect(courses[0]).toMatchObject({ id: "course-1", concluded: false, assignmentCount: 1 });
    expect(page.assignments[0]).toMatchObject({
      dueAt: null,
      points: 12.5,
      type: "lab",
      late: true,
      missing: false,
    });
    expect(request).toHaveBeenCalledWith("/canvas/assignments?no_due_date=true");
  });

  it("sends CSRF-protected verify, sync, and selection mutations", async () => {
    request.mockResolvedValue({});
    await canvasService.verify();
    await canvasService.sync(true);
    await canvasService.setCourseSelection("course / unsafe", false);

    expect(request).toHaveBeenNthCalledWith(1, "/canvas/verify", { method: "POST" });
    expect(request).toHaveBeenNthCalledWith(2, "/canvas/sync", {
      method: "POST",
      body: JSON.stringify({ include_concluded: true }),
    });
    expect(request).toHaveBeenNthCalledWith(3, "/canvas/courses/course%20%2F%20unsafe", {
      method: "PATCH",
      body: JSON.stringify({ selected_for_sync: false }),
    });
  });
});

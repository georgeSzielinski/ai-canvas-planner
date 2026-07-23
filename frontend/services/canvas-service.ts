import type {
  CanvasAssignment,
  CanvasAssignmentResult,
  CanvasConnectionStatus,
  CanvasCourse,
  CanvasSyncReport,
} from "@/types/canvas";
import type { AssignmentType, SubmissionStatus } from "@/types/domain";
import { apiClient } from "./api-client";

interface CanvasCourseWire {
  id: string;
  canvas_course_id: string;
  name: string;
  course_code: string | null;
  enrollment_state: string | null;
  workflow_state: string | null;
  term_name: string | null;
  start_at: string | null;
  end_at: string | null;
  concluded: boolean;
  favorite: boolean | null;
  selected_for_sync: boolean;
  archived: boolean;
  assignment_count: number;
  last_seen_at: string;
}

interface CanvasAssignmentWire {
  id: string;
  canvas_assignment_id: string;
  course_id: string;
  course_name: string;
  title: string;
  description: string;
  category: AssignmentType;
  category_reason: string;
  canvas_url: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  assignment_group: string | null;
  grading_type: string | null;
  published: boolean;
  omitted_from_final_grade: boolean;
  peer_reviews: boolean;
  workflow_state: string | null;
  submission_status: SubmissionStatus;
  submitted_at: string | null;
  graded_at: string | null;
  score: number | null;
  grade: string | null;
  late: boolean;
  missing: boolean;
  excused: boolean;
  attempt_count: number | null;
  seconds_late: number | null;
  completed: boolean;
  locked: boolean;
  archived: boolean;
  concluded_course: boolean;
  canvas_created_at: string | null;
  canvas_updated_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

interface CanvasAssignmentPageWire {
  items: CanvasAssignmentWire[];
  page: number;
  page_size: number;
  total: number;
}

export interface CanvasAssignmentFilters {
  course_id?: string;
  upcoming?: boolean;
  completed?: boolean;
  missing?: boolean;
  late?: boolean;
  no_due_date?: boolean;
  include_concluded?: boolean;
  include_archived?: boolean;
  page?: number;
  page_size?: number;
}

function courseFromWire(item: CanvasCourseWire): CanvasCourse {
  return {
    id: item.id,
    canvasCourseId: item.canvas_course_id,
    name: item.name,
    shortName: item.course_code ?? item.name,
    color: "accent",
    ...(item.course_code ? { courseCode: item.course_code } : {}),
    ...(item.enrollment_state ? { enrollmentState: item.enrollment_state } : {}),
    ...(item.term_name ? { termName: item.term_name } : {}),
    concluded: item.concluded,
    selectedForSync: item.selected_for_sync,
    archived: item.archived,
    assignmentCount: item.assignment_count,
    lastSeenAt: item.last_seen_at,
  };
}

function assignmentFromWire(item: CanvasAssignmentWire): CanvasAssignment {
  return {
    id: item.id,
    courseId: item.course_id,
    title: item.title,
    description: item.description,
    type: item.category,
    dueAt: item.due_at,
    points: item.points_possible ?? 0,
    estimatedMinutes: 0,
    priority: "low",
    submissionStatus: item.submission_status,
    missing: item.missing,
    completionState: item.completed ? "completed" : "open",
    scheduledSessionIds: [],
    analysis: {
      difficulty: 1,
      urgency: 1,
      priorityScore: 0,
      explanation: item.category_reason,
      suggestedSteps: [],
    },
    canvasUrl: item.canvas_url ?? "",
    categoryReason: item.category_reason,
    late: item.late,
    excused: item.excused,
    locked: item.locked,
    published: item.published,
    concludedCourse: item.concluded_course,
    ...(item.workflow_state ? { workflowState: item.workflow_state } : {}),
    ...(item.submitted_at ? { submittedAt: item.submitted_at } : {}),
    ...(item.graded_at ? { gradedAt: item.graded_at } : {}),
    ...(item.score === null ? {} : { score: item.score }),
    ...(item.grade ? { grade: item.grade } : {}),
    source: "canvas",
  };
}

function queryString(filters: CanvasAssignmentFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const canvasService = {
  getStatus: () => apiClient.request<CanvasConnectionStatus>("/canvas/status"),
  verify: () =>
    apiClient.request<CanvasConnectionStatus>("/canvas/verify", {
      method: "POST",
    }),
  sync: (includeConcluded: boolean) =>
    apiClient.request<CanvasSyncReport>("/canvas/sync", {
      method: "POST",
      body: JSON.stringify({ include_concluded: includeConcluded }),
    }),
  getLatestSync: () => apiClient.request<CanvasSyncReport>("/canvas/sync/latest"),
  async getCourses(includeConcluded = false): Promise<CanvasCourse[]> {
    const suffix = includeConcluded ? "?include_concluded=true" : "";
    return (await apiClient.request<CanvasCourseWire[]>(`/canvas/courses${suffix}`)).map(
      courseFromWire,
    );
  },
  setCourseSelection: async (courseId: string, selected: boolean): Promise<CanvasCourse> =>
    courseFromWire(
      await apiClient.request<CanvasCourseWire>(`/canvas/courses/${encodeURIComponent(courseId)}`, {
        method: "PATCH",
        body: JSON.stringify({ selected_for_sync: selected }),
      }),
    ),
  async getAssignments(filters: CanvasAssignmentFilters = {}): Promise<CanvasAssignmentResult> {
    const payload = await apiClient.request<CanvasAssignmentPageWire>(
      `/canvas/assignments${queryString(filters)}`,
    );
    return {
      assignments: payload.items.map(assignmentFromWire),
      page: payload.page,
      pageSize: payload.page_size,
      total: payload.total,
    };
  },
};

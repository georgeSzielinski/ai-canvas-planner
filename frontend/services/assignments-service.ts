import type { Assignment } from "@/types/domain";
import { apiClient } from "./api-client";

export interface AssignmentWire {
  id: string;
  course_id: string;
  title: string;
  description: string;
  type: Assignment["type"];
  due_at: string;
  points: number;
  grade_weight: number | null;
  estimated_minutes: number;
  actual_minutes: number | null;
  priority: Assignment["priority"];
  submission_status: Assignment["submissionStatus"];
  missing: boolean;
  completion_state: Assignment["completionState"];
  scheduled_session_ids: string[];
  analysis: {
    difficulty: number;
    urgency: number;
    priority_score: number;
    explanation: string;
    suggested_steps: string[];
  };
  canvas_url: string;
}

export function assignmentFromWire(item: AssignmentWire): Assignment {
  return {
    id: item.id,
    courseId: item.course_id,
    title: item.title,
    description: item.description,
    type: item.type,
    dueAt: item.due_at,
    points: item.points,
    ...(item.grade_weight === null ? {} : { gradeWeight: item.grade_weight }),
    estimatedMinutes: item.estimated_minutes,
    ...(item.actual_minutes === null ? {} : { actualMinutes: item.actual_minutes }),
    priority: item.priority,
    submissionStatus: item.submission_status,
    missing: item.missing,
    completionState: item.completion_state,
    scheduledSessionIds: item.scheduled_session_ids,
    analysis: {
      difficulty: item.analysis.difficulty,
      urgency: item.analysis.urgency,
      priorityScore: item.analysis.priority_score,
      explanation: item.analysis.explanation,
      suggestedSteps: item.analysis.suggested_steps,
    },
    canvasUrl: item.canvas_url,
  };
}

export function assignmentPatchToWire(patch: Partial<Assignment>) {
  return {
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.estimatedMinutes === undefined ? {} : { estimated_minutes: patch.estimatedMinutes }),
    ...(patch.completionState === undefined ? {} : { completion_state: patch.completionState }),
    ...(patch.submissionStatus === undefined ? {} : { submission_status: patch.submissionStatus }),
    ...(patch.missing === undefined ? {} : { missing: patch.missing }),
  };
}

export interface AssignmentsService {
  list(): Promise<Assignment[]>;
  get(id: string): Promise<Assignment>;
  update(id: string, patch: Partial<Assignment>): Promise<Assignment>;
}

export const backendAssignmentsService: AssignmentsService = {
  list: async () =>
    (await apiClient.request<AssignmentWire[]>("/assignments")).map(assignmentFromWire),
  get: async (id) =>
    assignmentFromWire(await apiClient.request<AssignmentWire>(`/assignments/${id}`)),
  update: async (id, patch) =>
    assignmentFromWire(
      await apiClient.request<AssignmentWire>(`/assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(assignmentPatchToWire(patch)),
      }),
    ),
};

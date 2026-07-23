import type { Assignment, Course } from "./domain";

export type CanvasConnectionState =
  | "not_configured"
  | "not_verified"
  | "checking"
  | "connected"
  | "invalid_token"
  | "reconnect_required"
  | "permission_denied"
  | "rate_limited"
  | "canvas_unavailable"
  | "network_timeout"
  | "malformed_response";

export interface CanvasConnectionStatus {
  connected: boolean;
  configured: boolean;
  status: CanvasConnectionState | string;
  canvas_display_name: string | null;
  canvas_user_id: string | null;
  hostname: string | null;
  last_verified_at: string | null;
  last_successful_sync_at: string | null;
  last_attempted_sync_at: string | null;
  last_sync_status: string | null;
  last_error_code: string | null;
  include_concluded_courses: boolean;
  data_stale: boolean;
}

export interface CanvasSyncReport {
  id: string;
  status: "running" | "success" | "partial" | "failed" | "interrupted";
  courses_checked: number;
  courses_imported: number;
  assignments_created: number;
  assignments_updated: number;
  assignments_unchanged: number;
  assignments_archived: number;
  submission_states_updated: number;
  course_failures: number;
  warnings: string[];
  started_at: string;
  completed_at: string | null;
  error_code: string | null;
}

export interface CanvasCourse extends Course {
  canvasCourseId: string;
  concluded: boolean;
  selectedForSync: boolean;
  archived: boolean;
  assignmentCount: number;
  lastSeenAt: string;
}

export interface CanvasAssignment extends Assignment {
  source: "canvas";
}

export interface CanvasAssignmentResult {
  assignments: CanvasAssignment[];
  page: number;
  pageSize: number;
  total: number;
}

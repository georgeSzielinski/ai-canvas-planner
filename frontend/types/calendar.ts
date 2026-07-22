export interface CalendarConnection {
  connected: boolean;
  status: string;
  provider_email: string | null;
  permissions: string[];
  last_sync_at: string | null;
  last_error: string | null;
  reauthentication_required: boolean;
}

export interface GoogleCalendar {
  id: string;
  name: string;
  color: string | null;
  primary: boolean;
  access_role: string;
  can_read: boolean;
  can_write: boolean;
  selected_for_busy: boolean;
  selected_for_study: boolean;
}

export interface BackendCalendarPreferences {
  study_calendar_id: string | null;
  busy_calendar_ids: string[];
  publish_automatically: boolean;
  preview_before_publishing: boolean;
  default_reminder_minutes: number;
  default_event_color: string;
  protect_manually_edited_events: boolean;
  preserve_renamed_events: boolean;
  canvai_may_move_study_sessions: boolean;
  allow_weekend_scheduling: boolean;
  include_preparation_notes: boolean;
}

export interface StudyCalendar {
  id: string;
  name: string;
  color: string | null;
  created: boolean;
}

export interface BusyEvent {
  calendar_id: string;
  provider_event_id: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurring_event_id: string | null;
}

export interface BusySyncResult {
  status: "completed" | "failed";
  imported_count: number;
  all_day_count: number;
  recurring_count: number;
  conflicts: number;
  free_block_count?: number;
  travel_conflict_count?: number;
  overlapping_appointment_count?: number;
  synced_at: string;
  events: BusyEvent[];
}

export interface ActionStatus {
  status: string;
  message: string;
}

export interface StudySessionPreview {
  session_id: string;
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  reminder_minutes: number;
  description: string;
  confirmation_token: string;
}

export interface StudySessionPublication {
  session_id: string;
  calendar_id: string;
  provider_event_id: string;
  action: "created" | "updated" | "unchanged" | "protected";
  published_at: string | null;
}

export type ThemePreference = "light" | "dark" | "system";

export interface SessionStatus {
  authenticated: boolean;
  expires_at: string | null;
  csrf_token: string | null;
  reauthentication_required: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  profile_photo: string | null;
  timezone: string;
  onboarding_complete: boolean;
  preferred_theme: ThemePreference;
  school_year: string;
  week_starts_on: "monday" | "sunday";
  bedtime: string | null;
  wake_time: string | null;
  rowing_schedule: Array<Record<string, string>>;
  default_study_duration: number;
  preferred_calendar: string | null;
  calendar_consent: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  display_name?: string;
  timezone?: string;
  preferred_theme?: ThemePreference;
  school_year?: string;
  week_starts_on?: "monday" | "sunday";
  calendar_consent?: boolean;
}

export interface OnboardingUpdate {
  school_year: string;
  timezone: string;
  week_starts_on: "monday" | "sunday";
  bedtime: string;
  wake_time: string;
  rowing_schedule: Array<Record<string, string>>;
  default_study_duration: number;
  preferred_calendar: string | null;
  calendar_consent: boolean;
}

export interface ActionStatus {
  status: string;
  message: string;
}

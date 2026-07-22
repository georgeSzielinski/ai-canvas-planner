import { API_BASE_URL, apiClient, getApiCsrfToken } from "./api-client";
import type {
  ActionStatus,
  BackendCalendarPreferences,
  BusySyncResult,
  CalendarConnection,
  GoogleCalendar,
  StudyCalendar,
  StudySessionPreview,
  StudySessionPublication,
} from "@/types/calendar";

interface RequestClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

export class CalendarService {
  constructor(
    private readonly client: RequestClient = apiClient,
    private readonly getCsrfToken: () => string | null = getApiCsrfToken,
    private readonly baseUrl = API_BASE_URL,
  ) {}

  getStatus(): Promise<CalendarConnection> {
    return this.client.request<CalendarConnection>("/calendar/status");
  }

  connectUrl(reconnect = false): string {
    return `${this.baseUrl}/calendar/connect${reconnect ? "?reconnect=true" : ""}`;
  }

  disconnect(): Promise<ActionStatus> {
    return this.mutate<ActionStatus>("/calendar/disconnect");
  }

  revoke(): Promise<ActionStatus> {
    return this.mutate<ActionStatus>("/calendar/revoke");
  }

  getCalendars(): Promise<GoogleCalendar[]> {
    return this.client.request<GoogleCalendar[]>("/calendar/calendars");
  }

  getPreferences(): Promise<BackendCalendarPreferences> {
    return this.client.request<BackendCalendarPreferences>("/calendar/preferences");
  }

  savePreferences(preferences: BackendCalendarPreferences): Promise<BackendCalendarPreferences> {
    return this.mutate<BackendCalendarPreferences>("/calendar/preferences", "PATCH", preferences);
  }

  createStudyCalendar(name: string): Promise<StudyCalendar> {
    return this.mutate<StudyCalendar>("/calendar/study-calendar", "POST", { name });
  }

  syncBusy(timeMin: string, timeMax: string): Promise<BusySyncResult> {
    return this.mutate<BusySyncResult>("/calendar/sync-busy", "POST", {
      time_min: timeMin,
      time_max: timeMax,
    });
  }

  previewStudySession(sessionId: string): Promise<StudySessionPreview> {
    return this.client.request<StudySessionPreview>(
      `/calendar/study-sessions/${encodeURIComponent(sessionId)}/preview`,
    );
  }

  publishStudySession(
    sessionId: string,
    confirmationToken?: string,
  ): Promise<StudySessionPublication> {
    return this.mutate<StudySessionPublication>(
      `/calendar/study-sessions/${encodeURIComponent(sessionId)}/publish`,
      "POST",
      confirmationToken ? { confirmation_token: confirmationToken } : {},
    );
  }

  private mutate<T>(path: string, method = "POST", body?: unknown): Promise<T> {
    return this.client.request<T>(path, {
      method,
      headers: this.csrfHeaders(),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  private csrfHeaders(): Record<string, string> {
    const token = this.getCsrfToken();
    return token ? { "X-CSRF-Token": token } : {};
  }
}

export const calendarService = new CalendarService();

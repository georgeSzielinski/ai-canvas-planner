import { describe, expect, it, vi } from "vitest";
import { CalendarService } from "@/services/calendar-service";

const status = {
  connected: true,
  status: "connected",
  provider_email: "student@example.com",
  permissions: ["calendar.readonly", "calendar.events"],
  last_sync_at: "2026-07-21T18:00:00Z",
  last_error: null,
  reauthentication_required: false,
};

describe("CalendarService", () => {
  it("uses typed calendar endpoints and CSRF protection for mutations", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({ status: "disconnected", message: "Disconnected" });
    const service = new CalendarService({ request }, () => "csrf-value", "http://api.test/api/v1");

    await expect(service.getStatus()).resolves.toEqual(status);
    await expect(service.disconnect()).resolves.toEqual({
      status: "disconnected",
      message: "Disconnected",
    });

    expect(request).toHaveBeenNthCalledWith(1, "/calendar/status");
    expect(request).toHaveBeenNthCalledWith(2, "/calendar/disconnect", {
      method: "POST",
      headers: { "X-CSRF-Token": "csrf-value" },
    });
  });

  it("builds connect and reconnect URLs", () => {
    const service = new CalendarService({ request: vi.fn() }, () => null, "http://api.test/api/v1");
    expect(service.connectUrl()).toBe("http://api.test/api/v1/calendar/connect");
    expect(service.connectUrl(true)).toBe("http://api.test/api/v1/calendar/connect?reconnect=true");
  });

  it("supports discovery, preferences, study calendar creation, revoke, and busy sync", async () => {
    const request = vi.fn().mockResolvedValue({});
    const service = new CalendarService({ request }, () => "token");
    const preferences = {
      study_calendar_id: "study",
      busy_calendar_ids: ["school"],
      publish_automatically: false,
      preview_before_publishing: true,
      default_reminder_minutes: 10,
      default_event_color: "#1d4ed8",
      protect_manually_edited_events: true,
      preserve_renamed_events: true,
      canvai_may_move_study_sessions: true,
      allow_weekend_scheduling: true,
      include_preparation_notes: true,
    };

    await service.getCalendars();
    await service.getPreferences();
    await service.savePreferences(preferences);
    await service.createStudyCalendar("Study plan");
    await service.syncBusy("2026-07-21T00:00:00Z", "2026-08-18T00:00:00Z");
    await service.revoke();

    expect(request.mock.calls).toEqual([
      ["/calendar/calendars"],
      ["/calendar/preferences"],
      [
        "/calendar/preferences",
        {
          method: "PATCH",
          headers: { "X-CSRF-Token": "token" },
          body: JSON.stringify(preferences),
        },
      ],
      [
        "/calendar/study-calendar",
        {
          method: "POST",
          headers: { "X-CSRF-Token": "token" },
          body: JSON.stringify({ name: "Study plan" }),
        },
      ],
      [
        "/calendar/sync-busy",
        {
          method: "POST",
          headers: { "X-CSRF-Token": "token" },
          body: JSON.stringify({
            time_min: "2026-07-21T00:00:00Z",
            time_max: "2026-08-18T00:00:00Z",
          }),
        },
      ],
      ["/calendar/revoke", { method: "POST", headers: { "X-CSRF-Token": "token" } }],
    ]);
  });
});

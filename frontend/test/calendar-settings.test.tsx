import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AppProvider } from "@/components/common/app-provider";
import { ToastRegion } from "@/components/common/ui";
import { SettingsPage } from "@/features/settings/settings-page";
import { ApiError } from "@/services/api-client";

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  getCalendars: vi.fn(),
  getPreferences: vi.fn(),
  savePreferences: vi.fn(),
  createStudyCalendar: vi.fn(),
  syncBusy: vi.fn(),
  disconnect: vi.fn(),
  revoke: vi.fn(),
  connectUrl: vi.fn(() => "http://api.test/calendar/connect"),
}));

vi.mock("@/services/calendar-service", () => ({ calendarService: mocks }));

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

beforeEach(() => {
  mocks.getStatus.mockResolvedValue({
    connected: true,
    status: "connected",
    provider_email: "student@example.com",
    permissions: ["calendar.readonly", "calendar.events"],
    last_sync_at: "2026-07-21T18:00:00Z",
    last_error: null,
    reauthentication_required: false,
  });
  mocks.getCalendars.mockResolvedValue([
    {
      id: "school",
      name: "School",
      color: "#2563eb",
      primary: true,
      access_role: "owner",
      can_read: true,
      can_write: true,
      selected_for_busy: true,
      selected_for_study: false,
    },
    {
      id: "study",
      name: "Study plan",
      color: "#16a34a",
      primary: false,
      access_role: "owner",
      can_read: true,
      can_write: true,
      selected_for_busy: false,
      selected_for_study: true,
    },
  ]);
  mocks.getPreferences.mockResolvedValue(preferences);
  mocks.savePreferences.mockImplementation(async (value) => value);
  mocks.syncBusy.mockResolvedValue({
    status: "completed",
    imported_count: 7,
    all_day_count: 1,
    recurring_count: 2,
    conflicts: 0,
    synced_at: "2026-07-21T19:00:00Z",
    events: [],
  });
  mocks.disconnect.mockResolvedValue({
    status: "disconnected",
    message: "Google Calendar was disconnected locally.",
  });
});

it("loads real calendar state and saves all calendar preferences", async () => {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <SettingsPage />
      <ToastRegion />
    </AppProvider>,
  );

  expect(await screen.findByText("student@example.com")).toBeInTheDocument();
  expect(screen.getAllByText(/calendar\.readonly/)).not.toHaveLength(0);
  expect(screen.getByLabelText("Study calendar")).toHaveValue("study");
  expect(screen.getByRole("checkbox", { name: "School" })).toBeChecked();

  await user.click(screen.getByRole("switch", { name: "Automatic publishing" }));
  await user.clear(screen.getByLabelText("Default reminder (minutes)"));
  await user.type(screen.getByLabelText("Default reminder (minutes)"), "20");
  await user.click(screen.getByRole("button", { name: "Save calendar preferences" }));

  expect(mocks.savePreferences).toHaveBeenCalledWith(
    expect.objectContaining({
      study_calendar_id: "study",
      busy_calendar_ids: ["school"],
      publish_automatically: true,
      default_reminder_minutes: 20,
    }),
  );
  expect(await screen.findByText("Calendar preferences saved")).toBeInTheDocument();
});

it("syncs busy events and confirms disconnect", async () => {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <SettingsPage />
      <ToastRegion />
    </AppProvider>,
  );
  await screen.findByText("student@example.com");

  await user.click(screen.getByRole("button", { name: "Sync busy times" }));
  expect(await screen.findByLabelText("Busy sync summary")).toHaveTextContent(
    "7 busy events imported",
  );

  const connection = screen.getByTestId("google-calendar-connection");
  await user.click(within(connection).getByRole("button", { name: "Disconnect" }));
  expect(screen.getByRole("dialog", { name: "Disconnect Google Calendar?" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Confirm disconnect" }));
  await waitFor(() => expect(mocks.disconnect).toHaveBeenCalled());
  expect(await screen.findByText("Google Calendar was disconnected locally.")).toBeInTheDocument();
});

it("shows actionable calendar errors", async () => {
  mocks.getStatus.mockRejectedValueOnce(new Error("network down"));
  render(
    <AppProvider>
      <SettingsPage />
    </AppProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /couldn’t load Google Calendar settings/i,
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

it("directs users to sign in again when the session expired", async () => {
  mocks.getStatus.mockRejectedValueOnce(
    new ApiError("Request failed: 401", 401, { detail: "Authentication required" }),
  );
  render(
    <AppProvider>
      <SettingsPage />
    </AppProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(/sign in again/i);
});

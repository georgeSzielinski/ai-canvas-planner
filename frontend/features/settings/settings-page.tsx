"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  CalendarDots,
  CheckCircle,
  Clock,
  GearSix,
  GraduationCap,
  MoonStars,
  Plus,
  SlidersHorizontal,
  Sparkle,
  User,
  Warning,
} from "@phosphor-icons/react";
import { useApp } from "@/components/common/app-provider";
import { CanvasIntegrationPanel } from "@/components/canvas/canvas-integration-panel";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import { Badge, Button, Card, LoadingState, Modal, SectionHeader } from "@/components/common/ui";

import { courseToneClass } from "@/lib/course-style";
import { ApiError } from "@/services/api-client";
import { calendarService } from "@/services/calendar-service";
import type {
  BackendCalendarPreferences,
  BusySyncResult,
  CalendarConnection,
  GoogleCalendar,
} from "@/types/calendar";
import type { AppSettings, RoutineBlock } from "@/types/domain";

const sections = [
  { id: "account", label: "Account", icon: User },
  { id: "connections", label: "Connected Accounts", icon: GraduationCap },
  { id: "calendar", label: "Google Calendar", icon: CalendarDots },
  { id: "notifications", label: "Notifications", icon: CheckCircle },
  { id: "privacy", label: "Privacy", icon: User },
  { id: "permissions", label: "Permissions", icon: Warning },
  { id: "synchronization", label: "Synchronization", icon: CalendarDots },
  { id: "health", label: "Connection Health", icon: CheckCircle },
  { id: "routine", label: "Weekly routine", icon: Clock },
  { id: "study", label: "Study preferences", icon: SlidersHorizontal },
  { id: "sleep", label: "Sleep & recovery", icon: MoonStars },
  { id: "subjects", label: "Subjects", icon: GraduationCap },
  { id: "rules", label: "Assignment rules", icon: GearSix },
  { id: "ai", label: "AI preferences", icon: Brain },
];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const defaultCalendarPreferences: BackendCalendarPreferences = {
  study_calendar_id: null,
  busy_calendar_ids: [],
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

function calendarError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again, then retry.";
    if (error.status === 403)
      return "Calendar permission was denied. Reconnect Google Calendar and grant the requested permissions.";
    const details = error.details as { detail?: string } | undefined;
    if (details?.detail) return `${details.detail} Check your connection and try again.`;
  }
  return `${fallback} Check your connection and try again.`;
}

function formatSync(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Never";
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <div className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        className={`switch ${value ? "on" : ""}`}
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange(value: string): void;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function FormInput({
  label,
  value,
  type = "text",
  onChange,
  min,
  max,
}: {
  label: string;
  value: string | number;
  type?: string;
  onChange(value: string): void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SettingsPage() {
  const auth = useOptionalAuth();
  const {
    backendMode,
    loading,
    courses,
    routine: routineBlocks,
    settings,
    refreshCalendarConnection,
    updateSettings,

    showToast,
  } = useApp();
  const [draft, setDraft] = useState<AppSettings>(() => structuredClone(settings));
  const [active, setActive] = useState("account");
  const [routine, setRoutine] = useState<RoutineBlock[]>(() => structuredClone(routineBlocks));
  const [routineOpen, setRoutineOpen] = useState(false);
  const [newRoutine, setNewRoutine] = useState({
    day: "Tuesday",
    activity: "School" as RoutineBlock["activity"],
    startTime: "08:30",
    endTime: "09:30",
  });
  const [validation, setValidation] = useState("");
  const [calendarConnection, setCalendarConnection] = useState<CalendarConnection | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [calendarPreferences, setCalendarPreferences] = useState<BackendCalendarPreferences>(
    defaultCalendarPreferences,
  );
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarFailure, setCalendarFailure] = useState("");
  const [syncResult, setSyncResult] = useState<BusySyncResult | null>(null);
  const [confirmCalendarAction, setConfirmCalendarAction] = useState<
    "disconnect" | "revoke" | null
  >(null);
  const [studyCalendarName, setStudyCalendarName] = useState("Canvas Sweeper Study");

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    setCalendarFailure("");
    try {
      const connection = await refreshCalendarConnection();
      setCalendarConnection(connection);
      if (connection.connected) {
        const [discovered, preferences] = await Promise.all([
          calendarService.getCalendars(),
          calendarService.getPreferences(),
        ]);
        setCalendars(discovered);
        setCalendarPreferences(preferences);
      } else {
        setCalendars([]);
      }
    } catch (error) {
      setCalendarFailure(calendarError(error, "Couldn’t load Google Calendar settings."));
    } finally {
      setCalendarLoading(false);
    }
  }, [refreshCalendarConnection]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCalendar();
      const query = new URLSearchParams(window.location.search);
      if (query.get("calendar") === "connected") showToast("Google Calendar connected");
      if (query.has("calendar_error")) {
        setCalendarFailure(
          "Google authorization was not completed. Try reconnecting and grant calendar access.",
        );
      }
    });
  }, [loadCalendar, showToast]);
  useEffect(() => {
    queueMicrotask(() => setDraft(structuredClone(settings)));
  }, [settings]);
  useEffect(() => {
    queueMicrotask(() => setRoutine(structuredClone(routineBlocks)));
  }, [routineBlocks]);
  const scrollTo = (id: string) => {
    setActive(id);
    document
      .getElementById(`settings-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const save = () => {
    if (!draft.profile.displayName.trim()) {
      setValidation("Display name is required.");
      scrollTo("account");
      return;
    }
    setValidation("");
    updateSettings(draft);
  };
  const updateProfile = (key: keyof AppSettings["profile"], value: string) =>
    setDraft((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  const updateStudy = (key: keyof AppSettings["study"], value: string | number | boolean) =>
    setDraft((current) => ({ ...current, study: { ...current.study, [key]: value } }));
  const updateSleep = (key: keyof AppSettings["sleep"], value: string | boolean) =>
    setDraft((current) => ({ ...current, sleep: { ...current.sleep, [key]: value } }));
  const updateAI = (key: keyof AppSettings["ai"], value: string | boolean) =>
    setDraft((current) => ({ ...current, ai: { ...current.ai, [key]: value } }));
  const updateRule = (key: keyof AppSettings["rules"], value: boolean) =>
    setDraft((current) => ({ ...current, rules: { ...current.rules, [key]: value } }));
  const addRoutine = () => {
    setRoutine((items) => [
      ...items,
      {
        id: `routine-${Date.now()}`,
        day: newRoutine.day,
        activity: newRoutine.activity,
        startTime: newRoutine.startTime,
        endTime: newRoutine.endTime,
        color:
          newRoutine.activity === "Rowing"
            ? "green"
            : newRoutine.activity === "Dinner"
              ? "amber"
              : newRoutine.activity === "Lifting"
                ? "accent"
                : "gray",
      },
    ]);
    setRoutineOpen(false);
    showToast("Recurring routine block added locally");
  };

  const runCalendarAction = async (action: () => Promise<void>, fallback: string) => {
    setCalendarBusy(true);
    setCalendarFailure("");
    try {
      await action();
    } catch (error) {
      setCalendarFailure(calendarError(error, fallback));
    } finally {
      setCalendarBusy(false);
    }
  };

  const saveCalendarPreferences = () =>
    runCalendarAction(async () => {
      const saved = await calendarService.savePreferences(calendarPreferences);
      setCalendarPreferences(saved);
      showToast("Calendar preferences saved");
    }, "Couldn’t save calendar preferences.");

  const createStudyCalendar = () =>
    runCalendarAction(async () => {
      if (!studyCalendarName.trim()) throw new Error("name required");
      const created = await calendarService.createStudyCalendar(studyCalendarName.trim());
      const discovered = await calendarService.getCalendars();
      setCalendars(discovered);
      setCalendarPreferences((current) => ({ ...current, study_calendar_id: created.id }));
      showToast(`${created.name} created`);
    }, "Couldn’t create the study calendar. Enter a name and try again.");

  const syncBusyTimes = () =>
    runCalendarAction(async () => {
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + 28);
      const result = await calendarService.syncBusy(start.toISOString(), end.toISOString());
      setSyncResult(result);
      setCalendarConnection((current) =>
        current
          ? {
              ...current,
              last_sync_at: result.synced_at,
              last_error: result.status === "failed" ? "Busy sync failed" : null,
            }
          : current,
      );
      showToast(`${result.imported_count} busy events imported`);
    }, "Couldn’t sync busy times.");

  const confirmConnectionAction = () =>
    runCalendarAction(
      async () => {
        const action = confirmCalendarAction;
        if (!action) return;
        const result =
          action === "revoke" ? await calendarService.revoke() : await calendarService.disconnect();
        setConfirmCalendarAction(null);
        setCalendarConnection((current) =>
          current
            ? {
                ...current,
                connected: false,
                status: result.status,
                provider_email: null,
                permissions: [],
              }
            : current,
        );
        setCalendars([]);
        showToast(result.message);
      },
      `Couldn’t ${confirmCalendarAction ?? "update"} Google Calendar.`,
    );

  if (loading) return <LoadingState label="Loading settings" />;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Control the routines, guardrails, and preferences used by your account workspace.</p>
        </div>
        <Badge tone="accent">
          {backendMode ? "Saved to your account" : "Saved in this browser"}
        </Badge>
      </div>
      <div className="settings-shell">
        <Card className="settings-nav" as="nav">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => scrollTo(id)}>
              <Icon />
              {label}
            </button>
          ))}
        </Card>
        <div className="settings-content">
          <Card className="settings-section" id="settings-account" as="section">
            <SectionHeader title="Account" eyebrow="Identity & display" />
            <div className="settings-section-body">
              <div className="form-grid">
                <FormInput
                  label="Display name"
                  value={draft.profile.displayName}
                  onChange={(value) => updateProfile("displayName", value)}
                />
                <FormSelect
                  label="Time zone"
                  value={draft.profile.timeZone}
                  onChange={(value) => updateProfile("timeZone", value)}
                >
                  <option>America/Los_Angeles</option>
                  <option>America/Denver</option>
                  <option>America/Chicago</option>
                  <option>America/New_York</option>
                </FormSelect>
                <FormSelect
                  label="School year"
                  value={draft.profile.schoolYear}
                  onChange={(value) => updateProfile("schoolYear", value)}
                >
                  <option>Freshman</option>
                  <option>Sophomore</option>
                  <option>Junior</option>
                  <option>Senior</option>
                </FormSelect>
                <FormSelect
                  label="Week starts"
                  value={draft.profile.weekStart}
                  onChange={(value) => updateProfile("weekStart", value)}
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </FormSelect>
                <FormSelect
                  label="Theme"
                  value={draft.profile.theme}
                  onChange={(value) => updateProfile("theme", value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </FormSelect>
              </div>
              {validation && (
                <p className="field-error" role="alert">
                  {validation}
                </p>
              )}
            </div>
          </Card>
          <Card className="settings-section" id="settings-connections" as="section">
            <SectionHeader title="Connected accounts" eyebrow="Account access" />
            <div className="settings-section-body">
              <div className="connection-settings">
                <CanvasIntegrationPanel />
                <div className="connection-setting" data-testid="google-calendar-connection">
                  <span>
                    <CalendarDots />
                  </span>
                  <div>
                    <strong>Google Calendar</strong>
                    {calendarLoading ? (
                      <p>Checking connection…</p>
                    ) : calendarConnection?.connected ? (
                      <>
                        <p>{calendarConnection.provider_email}</p>
                        <p>
                          <b>Permissions:</b>{" "}
                          {calendarConnection.permissions.join(", ") || "None reported"}
                        </p>
                      </>
                    ) : (
                      <p>Not connected · no events published</p>
                    )}
                  </div>
                  <div className="connection-setting-actions">
                    <Badge tone={calendarConnection?.connected ? "success" : "neutral"}>
                      {calendarConnection?.connected ? "Connected" : "Not connected"}
                    </Badge>
                    {!calendarConnection?.connected &&
                      (auth?.user?.calendar_consent ?? !backendMode) && (
                        <Button
                          onClick={() => window.location.assign(calendarService.connectUrl())}
                        >
                          Connect
                        </Button>
                      )}
                    {!calendarConnection?.connected && auth && !auth.user?.calendar_consent && (
                      <Button
                        onClick={() => {
                          void auth
                            .updateProfile({ calendar_consent: true })
                            .then(() => showToast("Google Calendar consent enabled"))
                            .catch(() => showToast("Could not save Calendar consent."));
                        }}
                      >
                        Enable Calendar consent
                      </Button>
                    )}
                    {calendarConnection?.connected && (
                      <>
                        <Button
                          onClick={() => window.location.assign(calendarService.connectUrl(true))}
                        >
                          Reconnect
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => setConfirmCalendarAction("disconnect")}
                        >
                          Disconnect
                        </Button>
                        <Button variant="danger" onClick={() => setConfirmCalendarAction("revoke")}>
                          Revoke access
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="connection-setting">
                  <span>
                    <Sparkle />
                  </span>
                  <div>
                    <strong>AI provider</strong>
                    <p>Local deterministic service</p>
                  </div>
                  <Badge>No external AI</Badge>
                </div>
              </div>
            </div>
          </Card>
          <Card className="settings-section" id="settings-calendar" as="section">
            <SectionHeader
              title="Google Calendar"
              eyebrow="Publishing preferences"
              aside={
                <Badge>
                  Last sync:{" "}
                  {formatSync(syncResult?.synced_at ?? calendarConnection?.last_sync_at ?? null)}
                </Badge>
              }
            />
            <div className="settings-section-body">
              {calendarFailure && (
                <div className="calendar-error" role="alert">
                  <Warning />
                  <span>{calendarFailure}</span>
                  <Button onClick={() => void loadCalendar()}>Try again</Button>
                </div>
              )}
              {calendarConnection?.last_error && (
                <p className="field-error" role="alert">
                  Last sync error: {calendarConnection.last_error}
                </p>
              )}
              {calendarConnection?.reauthentication_required && (
                <div className="warning-callout">
                  <Warning />
                  <span>Google requires you to reconnect before syncing or publishing.</span>
                </div>
              )}
              {!calendarConnection?.connected && !calendarLoading ? (
                <div className="calendar-empty">
                  <p>
                    Connect Google Calendar to discover calendars, import busy times, and publish
                    study sessions.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => window.location.assign(calendarService.connectUrl())}
                  >
                    Connect Google Calendar
                  </Button>
                </div>
              ) : calendarConnection?.connected ? (
                <>
                  <div className="form-grid">
                    <FormSelect
                      label="Study calendar"
                      value={calendarPreferences.study_calendar_id ?? ""}
                      onChange={(value) =>
                        setCalendarPreferences((current) => ({
                          ...current,
                          study_calendar_id: value || null,
                        }))
                      }
                    >
                      <option value="">Select a writable calendar</option>
                      {calendars
                        .filter((calendar) => calendar.can_write)
                        .map((calendar) => (
                          <option key={calendar.id} value={calendar.id}>
                            {calendar.name}
                            {calendar.primary ? " (primary)" : ""}
                          </option>
                        ))}
                    </FormSelect>
                    <FormInput
                      label="Default reminder (minutes)"
                      type="number"
                      min={0}
                      max={40320}
                      value={calendarPreferences.default_reminder_minutes}
                      onChange={(value) =>
                        setCalendarPreferences((current) => ({
                          ...current,
                          default_reminder_minutes: Number(value),
                        }))
                      }
                    />
                    <FormInput
                      label="Default event color"
                      type="color"
                      value={calendarPreferences.default_event_color}
                      onChange={(value) =>
                        setCalendarPreferences((current) => ({
                          ...current,
                          default_event_color: value,
                        }))
                      }
                    />
                    <div className="field create-calendar-field">
                      <span>Create a study calendar</span>
                      <div className="row">
                        <input
                          aria-label="New study calendar name"
                          value={studyCalendarName}
                          onChange={(event) => setStudyCalendarName(event.target.value)}
                        />
                        <Button
                          disabled={calendarBusy || !studyCalendarName.trim()}
                          onClick={() => void createStudyCalendar()}
                        >
                          Create
                        </Button>
                      </div>
                    </div>
                  </div>
                  <fieldset className="calendar-selector">
                    <legend>Calendars counted as busy</legend>
                    {calendars
                      .filter((calendar) => calendar.can_read)
                      .map((calendar) => (
                        <label key={calendar.id}>
                          <input
                            type="checkbox"
                            aria-label={calendar.name}
                            checked={calendarPreferences.busy_calendar_ids.includes(calendar.id)}
                            onChange={(event) =>
                              setCalendarPreferences((current) => ({
                                ...current,
                                busy_calendar_ids: event.target.checked
                                  ? [...new Set([...current.busy_calendar_ids, calendar.id])]
                                  : current.busy_calendar_ids.filter((id) => id !== calendar.id),
                              }))
                            }
                          />
                          <i style={{ background: calendar.color ?? "var(--text-3)" }} />
                          <span>
                            <strong>{calendar.name}</strong>
                            <small>
                              {calendar.access_role} ·{" "}
                              {calendar.can_write ? "read and write" : "read only"}
                            </small>
                          </span>
                        </label>
                      ))}
                  </fieldset>
                  <Toggle
                    label="Automatic publishing"
                    description="Publish study sessions without a preview."
                    value={calendarPreferences.publish_automatically}
                    onChange={(value) =>
                      setCalendarPreferences((current) => ({
                        ...current,
                        publish_automatically: value,
                      }))
                    }
                  />
                  <Toggle
                    label="Preview before publishing"
                    value={calendarPreferences.preview_before_publishing}
                    onChange={(value) =>
                      setCalendarPreferences((current) => ({
                        ...current,
                        preview_before_publishing: value,
                      }))
                    }
                  />
                  <Toggle
                    label="Protect manually edited events"
                    value={calendarPreferences.protect_manually_edited_events}
                    onChange={(value) =>
                      setCalendarPreferences((current) => ({
                        ...current,
                        protect_manually_edited_events: value,
                      }))
                    }
                  />
                  <Toggle
                    label="Preserve renamed events"
                    value={calendarPreferences.preserve_renamed_events}
                    onChange={(value) =>
                      setCalendarPreferences((current) => ({
                        ...current,
                        preserve_renamed_events: value,
                      }))
                    }
                  />
                  <Toggle
                    label="Canvai may move study sessions"
                    value={calendarPreferences.canvai_may_move_study_sessions}
                    onChange={(value) =>
                      setCalendarPreferences((current) => ({
                        ...current,
                        canvai_may_move_study_sessions: value,
                      }))
                    }
                  />
                  <Toggle
                    label="Allow weekend scheduling"
                    value={calendarPreferences.allow_weekend_scheduling}
                    onChange={(value) =>
                      setCalendarPreferences((current) => ({
                        ...current,
                        allow_weekend_scheduling: value,
                      }))
                    }
                  />
                  <Toggle
                    label="Include preparation notes"
                    value={calendarPreferences.include_preparation_notes}
                    onChange={(value) =>
                      setCalendarPreferences((current) => ({
                        ...current,
                        include_preparation_notes: value,
                      }))
                    }
                  />
                  {syncResult && (
                    <div className="sync-summary" aria-label="Busy sync summary">
                      <strong>{syncResult.imported_count} busy events imported</strong>
                      <span>
                        {syncResult.all_day_count} all-day · {syncResult.recurring_count} recurring
                        · {syncResult.overlapping_appointment_count ?? syncResult.conflicts}{" "}
                        overlapping · {syncResult.free_block_count ?? 0} free blocks ·{" "}
                        {syncResult.travel_conflict_count ?? 0} travel conflicts
                      </span>
                    </div>
                  )}
                  <div className="form-actions">
                    <Button
                      disabled={calendarBusy || !calendarPreferences.busy_calendar_ids.length}
                      onClick={() => void syncBusyTimes()}
                    >
                      Sync busy times
                    </Button>
                    <Button
                      variant="primary"
                      disabled={calendarBusy}
                      onClick={() => void saveCalendarPreferences()}
                    >
                      Save calendar preferences
                    </Button>
                  </div>
                </>
              ) : (
                <p>Loading calendar settings…</p>
              )}
            </div>
          </Card>
          <Card className="settings-section" id="settings-notifications" as="section">
            <SectionHeader title="Notifications" eyebrow="Calendar activity" />
            <div className="settings-section-body">
              <p>
                Connection, disconnection, calendar creation, sync completion or failure, expired
                permissions, reauthentication, and unavailable-calendar notices appear in the
                notification drawer and as actionable status messages.
              </p>
            </div>
          </Card>
          <Card className="settings-section" id="settings-privacy" as="section">
            <SectionHeader title="Privacy" eyebrow="Calendar data minimization" />
            <div className="settings-section-body">
              <p>
                Busy-time sync stores provider identifiers, start/end times, all-day and recurrence
                flags only. Event titles, descriptions, locations, organizers, and attendees are not
                cached. Disconnect removes local credentials; Revoke access also withdraws Google
                permission.
              </p>
            </div>
          </Card>
          <Card className="settings-section" id="settings-permissions" as="section">
            <SectionHeader title="Permissions" eyebrow="Google access" />
            <div className="settings-section-body">
              <p>
                {calendarConnection?.connected
                  ? calendarConnection.permissions.join(", ") || "Google did not report scopes."
                  : "Connect Google Calendar to review granted permissions."}
              </p>
              {calendarConnection?.reauthentication_required && (
                <Button onClick={() => window.location.assign(calendarService.connectUrl(true))}>
                  Reauthenticate
                </Button>
              )}
            </div>
          </Card>
          <Card className="settings-section" id="settings-synchronization" as="section">
            <SectionHeader title="Synchronization" eyebrow="Busy-time import" />
            <div className="settings-section-body">
              <p>
                Last sync:{" "}
                {formatSync(syncResult?.synced_at ?? calendarConnection?.last_sync_at ?? null)}
              </p>
              {syncResult && (
                <p>
                  {syncResult.imported_count} events · {syncResult.all_day_count} all-day ·{" "}
                  {syncResult.recurring_count} recurring ·{" "}
                  {syncResult.overlapping_appointment_count ?? syncResult.conflicts} overlapping ·{" "}
                  {syncResult.free_block_count ?? 0} free blocks ·{" "}
                  {syncResult.travel_conflict_count ?? 0} travel conflicts
                </p>
              )}
              <Button
                disabled={calendarBusy || !calendarPreferences.busy_calendar_ids.length}
                onClick={() => void syncBusyTimes()}
              >
                Sync now
              </Button>
            </div>
          </Card>
          <Card className="settings-section" id="settings-health" as="section">
            <SectionHeader title="Connection Health" eyebrow="Recovery status" />
            <div className="settings-section-body">
              <div className="connection-health-row">
                <Badge tone={calendarConnection?.connected ? "success" : "warning"}>
                  {calendarConnection?.status ?? "unavailable"}
                </Badge>
                <span>
                  {calendarConnection?.last_error ??
                    (calendarConnection?.connected
                      ? "Google Calendar is available."
                      : "Google Calendar is not connected.")}
                </span>
              </div>
              <Button onClick={() => void loadCalendar()}>Check connection</Button>
            </div>
          </Card>
          <Card className="settings-section" id="settings-routine" as="section">
            <SectionHeader
              title="Weekly routine"
              eyebrow="Recurring availability"
              aside={
                !backendMode ? (
                  <Button icon={<Plus />} onClick={() => setRoutineOpen(true)}>
                    Add block
                  </Button>
                ) : undefined
              }
            />
            <div className="settings-section-body">
              <p>
                A structured week view—not a calendar replacement. Routine editing remains read-only
                in authenticated Phase 2 workspaces.
              </p>
              <div
                className="week-editor"
                tabIndex={0}
                aria-label="Scrollable weekly routine editor"
              >
                {days.map((day) => (
                  <div className="day-panel" key={day}>
                    <strong>{day.slice(0, 3)}</strong>
                    {routine
                      .filter((block) => block.day === day)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((block) => (
                        <div className={`routine-block ${block.color}`} key={block.id}>
                          <strong>{block.activity}</strong>
                          <time>
                            {block.startTime}–{block.endTime}
                          </time>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 11.5 }}>
                Supported recurring activities: School, Commute, Rowing, Lifting, Dinner, Sleep,
                Family, Appointments, Free time, and Custom.
              </p>
            </div>
          </Card>
          <Card className="settings-section" id="settings-study" as="section">
            <SectionHeader title="Study preferences" eyebrow="Workload & timing" />
            <div className="settings-section-body">
              <div className="form-grid">
                <FormInput
                  label="Earliest study time"
                  type="time"
                  value={draft.study.earliestTime}
                  onChange={(v) => updateStudy("earliestTime", v)}
                />
                <FormInput
                  label="Latest study time"
                  type="time"
                  value={draft.study.latestTime}
                  onChange={(v) => updateStudy("latestTime", v)}
                />
                {[
                  ["preferredSessionMinutes", "Preferred session duration"],
                  ["maxSessionMinutes", "Maximum session duration"],
                  ["breakMinutes", "Break length"],
                  ["weekdayWorkloadMinutes", "Weekday workload"],
                  ["weekendWorkloadMinutes", "Weekend workload"],
                  ["minimumFreeMinutes", "Minimum free time"],
                  ["emergencyBufferMinutes", "Emergency buffer"],
                ].map(([key, label]) => (
                  <FormInput
                    key={key}
                    label={`${label} (minutes)`}
                    type="number"
                    min={0}
                    max={600}
                    value={draft.study[key as keyof typeof draft.study] as number}
                    onChange={(v) => updateStudy(key as keyof AppSettings["study"], Number(v))}
                  />
                ))}
                {[
                  ["fridayNight", "Friday-night preference"],
                  ["saturdayNight", "Saturday-night preference"],
                  ["sundayNight", "Sunday-night preference"],
                ].map(([key, label]) => (
                  <FormSelect
                    key={key}
                    label={label}
                    value={draft.study[key as keyof typeof draft.study] as string}
                    onChange={(v) => updateStudy(key as keyof AppSettings["study"], v)}
                  >
                    <option value="avoid">Avoid</option>
                    <option value="light">Keep light</option>
                    <option value="normal">Normal</option>
                  </FormSelect>
                ))}
              </div>
              {[
                ["studyBeforeSchool", "Study before school"],
                ["studyAtLunch", "Study at lunch"],
                ["studyAfterRowing", "Study after rowing"],
              ].map(([key, label]) => (
                <Toggle
                  key={key as string}
                  label={label as string}
                  value={draft.study[key as keyof typeof draft.study] as boolean}
                  onChange={(v) => updateStudy(key as keyof AppSettings["study"], v)}
                />
              ))}
            </div>
          </Card>
          <Card className="settings-section" id="settings-sleep" as="section">
            <SectionHeader title="Sleep & recovery" eyebrow="Athlete-aware guardrails" />
            <div className="settings-section-body">
              <div className="form-grid">
                <FormInput
                  label="Current bedtime"
                  type="time"
                  value={draft.sleep.currentBedtime}
                  onChange={(v) => updateSleep("currentBedtime", v)}
                />
                <FormInput
                  label="Target bedtime"
                  type="time"
                  value={draft.sleep.targetBedtime}
                  onChange={(v) => updateSleep("targetBedtime", v)}
                />
                <FormInput
                  label="Wake time"
                  type="time"
                  value={draft.sleep.wakeTime}
                  onChange={(v) => updateSleep("wakeTime", v)}
                />
              </div>
              {[
                ["gradualAdjustment", "Gradual bedtime adjustment"],
                ["protectSleep", "Protect sleep"],
                ["preventLateStudy", "Prevent late-night study"],
                ["athleteRecoveryMode", "Athlete recovery mode"],
                ["avoidIntenseAfterTraining", "Avoid intense work after training"],
              ].map(([key, label]) => (
                <Toggle
                  key={key as string}
                  label={label as string}
                  value={draft.sleep[key as keyof typeof draft.sleep] as boolean}
                  onChange={(v) => updateSleep(key as keyof AppSettings["sleep"], v)}
                />
              ))}
            </div>
          </Card>
          <Card className="settings-section" id="settings-subjects" as="section">
            <SectionHeader title="Subjects" eyebrow="Difficulty & estimation" />
            <div className="settings-section-body">
              <table className="subject-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Difficulty</th>
                    <th>Confidence</th>
                    <th>Importance</th>
                    <th>Typical min</th>
                    <th>Test difficulty</th>
                    <th>Extra time</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.subjects.map((subject, index) => {
                    const course = courses.find((item) => item.id === subject.courseId);
                    if (!course) return null;
                    const update = (key: keyof typeof subject, value: number) =>
                      setDraft((current) => ({
                        ...current,
                        subjects: current.subjects.map((item, i) =>
                          i === index ? { ...item, [key]: value } : item,
                        ),
                      }));
                    return (
                      <tr key={subject.courseId}>
                        <td>
                          <span className={`subject-name ${courseToneClass(course.id)}`}>
                            <i />
                            {course.name}
                          </span>
                        </td>
                        {(
                          [
                            "difficulty",
                            "confidence",
                            "importance",
                            "typicalMinutes",
                            "testDifficulty",
                            "extraTimeMultiplier",
                          ] as const
                        ).map((key) => (
                          <td key={key}>
                            <input
                              className="text-input"
                              aria-label={`${course.name} ${key}`}
                              type="number"
                              step={key === "extraTimeMultiplier" ? ".1" : "1"}
                              min={key === "extraTimeMultiplier" ? 1 : 1}
                              max={
                                key === "typicalMinutes"
                                  ? 300
                                  : key === "extraTimeMultiplier"
                                    ? 3
                                    : 5
                              }
                              value={subject[key]}
                              onChange={(event) => update(key, Number(event.target.value))}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="settings-section" id="settings-rules" as="section">
            <SectionHeader title="Assignment rules" eyebrow="Scheduling policy" />
            <div className="settings-section-body">
              {[
                ["testsExtraPriority", "Give tests extra priority"],
                ["startEssaysEarly", "Start essays early"],
                ["splitLongAssignments", "Split long assignments"],
                ["createProjectMilestones", "Create project milestones"],
                ["missingOverrides", "Missing work overrides other work"],
                ["delayLowValueWhenOverloaded", "Delay low-value work when overloaded"],
                ["allowSameCourseSessions", "Allow multiple same-course sessions"],
                [
                  "includePrepInstructions",
                  "Add preparation instructions to calendar descriptions",
                ],
                ["rebuildMissedSchedules", "Rebuild missed schedules"],
                ["keepSundayLight", "Keep Sunday night light"],
                ["protectDailyFreeTime", "Protect daily free time"],
              ].map(([key, label]) => (
                <Toggle
                  key={key as string}
                  label={label as string}
                  value={draft.rules[key as keyof typeof draft.rules]}
                  onChange={(v) => updateRule(key as keyof AppSettings["rules"], v)}
                />
              ))}
            </div>
          </Card>
          <Card className="settings-section" id="settings-ai" as="section">
            <SectionHeader title="AI preferences" eyebrow="Future provider controls" />
            <div className="settings-section-body">
              <div className="warning-callout" style={{ marginTop: 0 }}>
                <Warning />
                <span>
                  The Phase 1 provider is deterministic and local. No prompts, schedules, or school
                  data are sent externally.
                </span>
              </div>
              <div className="form-grid" style={{ marginTop: 14 }}>
                <FormInput
                  label="Provider"
                  value={draft.ai.provider}
                  onChange={(v) => updateAI("provider", v)}
                />
                <FormSelect
                  label="Analysis depth"
                  value={draft.ai.analysisDepth}
                  onChange={(v) => updateAI("analysisDepth", v)}
                >
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </FormSelect>
              </div>
              {[
                ["enabled", "AI enabled"],
                ["showReasoning", "Show reasoning"],
                ["automaticDuration", "Automatic duration estimation"],
                ["automaticClassification", "Automatic classification"],
                ["useCompletionHistory", "Use completion history"],
                ["askBeforeMajorChanges", "Ask before major changes"],
                ["estimateFeedback", "Estimate feedback"],
              ].map(([key, label]) => (
                <Toggle
                  key={key as string}
                  label={label as string}
                  value={draft.ai[key as keyof typeof draft.ai] as boolean}
                  onChange={(v) => updateAI(key as keyof AppSettings["ai"], v)}
                />
              ))}
            </div>
          </Card>
          <div className="settings-savebar">
            <span>
              Preferences are saved to your account; provider credentials remain server-side.
            </span>
            <div className="row">
              <Button variant="primary" icon={<CheckCircle />} onClick={save}>
                Save settings
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Modal
        open={routineOpen}
        onClose={() => setRoutineOpen(false)}
        title="Add recurring routine block"
        description="This updates the local weekly preview."
      >
        <div className="form-grid">
          <FormSelect
            label="Day"
            value={newRoutine.day}
            onChange={(v) => setNewRoutine((current) => ({ ...current, day: v }))}
          >
            {days.map((day) => (
              <option key={day}>{day}</option>
            ))}
          </FormSelect>
          <FormSelect
            label="Activity"
            value={newRoutine.activity}
            onChange={(v) =>
              setNewRoutine((current) => ({ ...current, activity: v as RoutineBlock["activity"] }))
            }
          >
            {[
              "School",
              "Commute",
              "Rowing",
              "Lifting",
              "Dinner",
              "Sleep",
              "Family",
              "Appointment",
              "Free time",
              "Custom",
            ].map((activity) => (
              <option key={activity}>{activity}</option>
            ))}
          </FormSelect>
          <FormInput
            label="Start time"
            type="time"
            value={newRoutine.startTime}
            onChange={(v) => setNewRoutine((current) => ({ ...current, startTime: v }))}
          />
          <FormInput
            label="End time"
            type="time"
            value={newRoutine.endTime}
            onChange={(v) => setNewRoutine((current) => ({ ...current, endTime: v }))}
          />
        </div>
        <div className="form-actions">
          <Button onClick={() => setRoutineOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={addRoutine}>
            Add block
          </Button>
        </div>
      </Modal>
      <Modal
        open={confirmCalendarAction !== null}
        onClose={() => setConfirmCalendarAction(null)}
        title={
          confirmCalendarAction === "revoke"
            ? "Revoke Google Calendar access?"
            : "Disconnect Google Calendar?"
        }
        description={
          confirmCalendarAction === "revoke"
            ? "Google permissions and saved credentials will be revoked. You will need to authorize again."
            : "Local credentials will be removed. Google access remains authorized until you revoke it."
        }
      >
        <div className="form-actions">
          <Button onClick={() => setConfirmCalendarAction(null)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={calendarBusy}
            onClick={() => void confirmConnectionAction()}
          >
            {confirmCalendarAction === "revoke" ? "Confirm revoke" : "Confirm disconnect"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

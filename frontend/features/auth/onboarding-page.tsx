"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Moon, Sparkle } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, Card, LoadingState } from "@/components/common/ui";
import type { OnboardingUpdate } from "@/types/auth";

const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function OnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedDestination = params.get("next");
  const destination =
    requestedDestination?.startsWith("/") && !requestedDestination.startsWith("//")
      ? requestedDestination
      : "/overview";
  const { status, user, completeOnboarding } = useAuth();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowingDays, setRowingDays] = useState("Monday, Tuesday, Thursday, Friday");
  const [rowingStart, setRowingStart] = useState("15:30");
  const [rowingEnd, setRowingEnd] = useState("18:00");
  const [form, setForm] = useState<OnboardingUpdate>({
    school_year: "",
    timezone: localTimezone(),
    week_starts_on: "monday",
    bedtime: "22:30",
    wake_time: "06:30",
    rowing_schedule: [],
    default_study_duration: 45,
    preferred_calendar: "Canvas Sweeper Study",
    calendar_consent: false,
  });

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=%2Fonboarding");
    if (status === "authenticated" && user?.onboarding_complete) router.replace(destination);
  }, [destination, router, status, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const rowing_schedule = rowingDays.trim()
        ? [{ days: rowingDays.trim(), start_time: rowingStart, end_time: rowingEnd }]
        : [];
      await completeOnboarding({ ...form, rowing_schedule });
      router.push(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Setup could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading")
    return (
      <div className="auth-loading">
        <LoadingState label="Loading setup" />
      </div>
    );
  if (status !== "authenticated" || user?.onboarding_complete) return null;

  return (
    <main className="onboarding-page">
      <form className="onboarding-shell" onSubmit={submit}>
        <header className="onboarding-heading">
          <span className="feature-icon">
            <Sparkle weight="fill" />
          </span>
          <div>
            <span className="eyebrow">Welcome to Canvai</span>
            <h1>Set up your study week</h1>
            <p>Tell Canvai about your routine. You can change these settings later.</p>
          </div>
        </header>
        {error && (
          <div className="auth-alert" role="alert">
            {error}
          </div>
        )}
        <Card className="onboarding-section">
          <h2>School & schedule</h2>
          <div className="form-grid">
            <label className="field">
              <span>School year</span>
              <input
                required
                maxLength={32}
                value={form.school_year}
                onChange={(e) => setForm({ ...form, school_year: e.target.value })}
                placeholder="e.g. Junior"
              />
            </label>
            <label className="field">
              <span>Time zone</span>
              <input
                required
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Week starts on</span>
              <select
                value={form.week_starts_on}
                onChange={(e) =>
                  setForm({ ...form, week_starts_on: e.target.value as "monday" | "sunday" })
                }
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </label>
            <label className="field">
              <span>Default study block</span>
              <select
                value={form.default_study_duration}
                onChange={(e) =>
                  setForm({ ...form, default_study_duration: Number(e.target.value) })
                }
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </label>
          </div>
        </Card>
        <Card className="onboarding-section">
          <h2>
            <Moon /> Sleep guardrails
          </h2>
          <div className="form-grid">
            <label className="field">
              <span>Bedtime</span>
              <input
                type="time"
                required
                value={form.bedtime}
                onChange={(e) => setForm({ ...form, bedtime: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Wake time</span>
              <input
                type="time"
                required
                value={form.wake_time}
                onChange={(e) => setForm({ ...form, wake_time: e.target.value })}
              />
            </label>
          </div>
        </Card>
        <Card className="onboarding-section">
          <h2>Rowing & calendar</h2>
          <div className="form-grid">
            <label className="field">
              <span>Rowing days</span>
              <input
                value={rowingDays}
                onChange={(e) => setRowingDays(e.target.value)}
                placeholder="Monday, Wednesday, Friday"
              />
            </label>
            <label className="field">
              <span>Rowing starts</span>
              <input
                type="time"
                value={rowingStart}
                onChange={(e) => setRowingStart(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Rowing ends</span>
              <input type="time" value={rowingEnd} onChange={(e) => setRowingEnd(e.target.value)} />
            </label>
            <label className="field">
              <span>Preferred study calendar</span>
              <select
                value={form.preferred_calendar ?? ""}
                onChange={(e) => setForm({ ...form, preferred_calendar: e.target.value || null })}
              >
                <option value="Canvas Sweeper Study">Canvas Sweeper Study</option>
                <option value="primary">Primary Google Calendar</option>
                <option value="">Choose after connecting</option>
              </select>
            </label>
          </div>
          <label className="toggle-row">
            <span>
              <strong>Allow Google Calendar planning</strong>
              <small>Canvai may use selected calendars after you connect them.</small>
            </span>
            <input
              type="checkbox"
              checked={form.calendar_consent}
              onChange={(e) => setForm({ ...form, calendar_consent: e.target.checked })}
            />
          </label>
        </Card>
        <div className="onboarding-actions">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Finish setup"}
            <ArrowRight />
          </Button>
        </div>
      </form>
    </main>
  );
}

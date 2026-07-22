"use client";

import { useState, type FormEvent } from "react";
import { UserCircle } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, Card, LoadingState } from "@/components/common/ui";
import type { AuthUser, ThemePreference, UserUpdate } from "@/types/auth";

function ProfileForm({
  user,
  save,
}: {
  user: AuthUser;
  save(update: UserUpdate): Promise<AuthUser>;
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [theme, setTheme] = useState<ThemePreference>(user.preferred_theme);
  const [schoolYear, setSchoolYear] = useState(user.school_year);
  const [weekStartsOn, setWeekStartsOn] = useState<"monday" | "sunday">(user.week_starts_on);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await save({
        display_name: displayName,
        timezone,
        preferred_theme: theme,
        school_year: schoolYear,
        week_starts_on: weekStartsOn,
      });
      setMessage("Profile saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="profile-card">
      <div className="profile-summary">
        <span className="feature-icon">
          <UserCircle />
        </span>
        <div>
          <strong>{user.display_name}</strong>
          <span>{user.email}</span>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>Display name</span>
            <input
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={user.email} disabled />
          </label>
          <label className="field">
            <span>Time zone</span>
            <input
              required
              maxLength={80}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Theme</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="field">
            <span>School year</span>
            <input
              required
              maxLength={32}
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Week starts on</span>
            <select
              value={weekStartsOn}
              onChange={(e) => setWeekStartsOn(e.target.value as "monday" | "sunday")}
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="profile-success" role="status">
            {message}
          </p>
        )}
        <div className="form-actions">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ProfilePage() {
  const { status, user, updateProfile } = useAuth();
  if (status === "loading") return <LoadingState label="Loading profile" />;
  if (!user) return null;
  return (
    <div className="page-stack profile-page">
      <div className="page-heading">
        <div>
          <h1>Profile</h1>
          <p>Manage the account details used across your workspace.</p>
        </div>
      </div>
      <ProfileForm user={user} save={updateProfile} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { ArrowClockwise, CheckCircle, GraduationCap, Warning } from "@phosphor-icons/react";
import { useApp } from "@/components/common/app-provider";
import { Badge, Button } from "@/components/common/ui";
import { ApiError } from "@/services/api-client";
import { canvasService } from "@/services/canvas-service";

function dateTime(value: string | null | undefined): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string): string {
  return (
    {
      not_configured: "Not configured",
      not_verified: "Not verified",
      checking: "Checking",
      connected: "Connected",
      invalid_token: "Invalid token",
      reconnect_required: "Reconnect required",
      permission_denied: "Permission issue",
      rate_limited: "Rate limited",
      canvas_unavailable: "Canvas unavailable",
      network_timeout: "Canvas unavailable",
      malformed_response: "Canvas response error",
    }[status] ?? status.replaceAll("_", " ")
  );
}

function safeCanvasError(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details as { error?: { code?: string } } | undefined;
    const code = details?.error?.code;
    if (code === "invalid_token" || error.status === 401) {
      return "Replace the expired local token in the server environment, restart the backend, then verify again.";
    }
    if (code === "permission_denied" || error.status === 403) {
      return "Canvas denied access. Confirm the token belongs to this account and has permission to read courses and assignments.";
    }
    if (code === "rate_limited" || error.status === 429) {
      return "Canvas is rate limiting requests. Wait briefly before trying again.";
    }
  }
  return "Canvas could not complete the request. Check the server configuration and try again.";
}

export function CanvasIntegrationPanel() {
  const {
    canvasConnection,
    canvasSyncReport,
    canvasLoading,
    courses,
    refreshCanvasWorkspace,
    showToast,
  } = useApp();
  const [includeConcludedOverride, setIncludeConcludedOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const status = checking ? "checking" : (canvasConnection?.status ?? "not_verified");
  const configured = canvasConnection?.configured ?? false;
  const connected = canvasConnection?.connected ?? false;
  const includeConcluded =
    includeConcludedOverride ?? canvasConnection?.include_concluded_courses ?? false;

  const verify = async () => {
    setBusy(true);
    setChecking(true);
    setError("");
    try {
      await canvasService.verify();
      if (!(await refreshCanvasWorkspace())) return;
      showToast("Canvas connection verified");
    } catch (cause) {
      setError(safeCanvasError(cause));
      await refreshCanvasWorkspace().catch(() => undefined);
    } finally {
      setChecking(false);
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      const report = await canvasService.sync(includeConcluded);
      if (!(await refreshCanvasWorkspace())) return;
      showToast(
        report.status === "partial"
          ? `Canvas sync completed with ${report.course_failures} course warning${report.course_failures === 1 ? "" : "s"}`
          : `Canvas sync imported ${report.assignments_created} new assignment${report.assignments_created === 1 ? "" : "s"}`,
      );
    } catch (cause) {
      setError(safeCanvasError(cause));
    } finally {
      setBusy(false);
    }
  };

  const updateCourse = async (courseId: string, selected: boolean) => {
    setBusy(true);
    setError("");
    try {
      await canvasService.setCourseSelection(courseId, selected);
      await refreshCanvasWorkspace();
    } catch (cause) {
      setError(safeCanvasError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="canvas-integration-panel" data-testid="canvas-integration">
      <div className="canvas-connection-summary">
        <span className="feature-icon">
          <GraduationCap />
        </span>
        <div>
          <strong>Canvas</strong>
          {canvasConnection?.canvas_display_name && <p>{canvasConnection.canvas_display_name}</p>}
          {canvasConnection?.hostname && <p>{canvasConnection.hostname}</p>}
          {!configured && (
            <p>
              Local-development credentials are managed through the local server environment. No
              token is stored or editable in this interface.
            </p>
          )}
        </div>
        <Badge
          tone={connected ? "success" : status === "reconnect_required" ? "danger" : "warning"}
        >
          {statusLabel(status)}
        </Badge>
      </div>

      {error && (
        <div className="calendar-error" role="alert">
          <Warning />
          <span>{error}</span>
        </div>
      )}
      {(canvasConnection?.data_stale || canvasSyncReport?.status === "partial") && configured && (
        <div className="warning-callout" role="alert">
          <Warning />
          <span>
            {canvasSyncReport?.status === "partial"
              ? `The latest sync was partial. ${canvasSyncReport.course_failures} course${canvasSyncReport.course_failures === 1 ? "" : "s"} could not be refreshed; existing data was preserved.`
              : "Canvas data may be stale. Run a sync before relying on recent changes."}
          </span>
        </div>
      )}

      <div className="canvas-freshness-grid">
        <span>
          <small>Last verified</small>
          <strong>{dateTime(canvasConnection?.last_verified_at)}</strong>
        </span>
        <span>
          <small>Last successful sync</small>
          <strong>{dateTime(canvasConnection?.last_successful_sync_at)}</strong>
        </span>
        <span>
          <small>Last attempted sync</small>
          <strong>{dateTime(canvasConnection?.last_attempted_sync_at)}</strong>
        </span>
        <span>
          <small>Latest status</small>
          <strong>{canvasConnection?.last_sync_status ?? "Never synced"}</strong>
        </span>
      </div>

      <label className="canvas-concluded-option">
        <input
          type="checkbox"
          checked={includeConcluded}
          onChange={(event) => setIncludeConcludedOverride(event.target.checked)}
        />
        <span>
          <strong>Include concluded courses</strong>
          <small>Useful during summer and for historical development testing.</small>
        </span>
      </label>

      <div className="form-actions">
        <Button disabled={!configured || busy || canvasLoading} onClick={() => void verify()}>
          {checking ? "Checking…" : "Verify connection"}
        </Button>
        <Button
          variant="primary"
          icon={<ArrowClockwise />}
          disabled={!connected || busy || canvasLoading}
          onClick={() => void sync()}
        >
          {busy && !checking ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {canvasSyncReport && (
        <div className="sync-summary" aria-label="Canvas sync summary">
          <strong>
            {canvasSyncReport.status === "partial" ? "Partial sync" : "Last sync"}:{" "}
            {canvasSyncReport.courses_checked} courses checked
          </strong>
          <span>
            {canvasSyncReport.assignments_created} created · {canvasSyncReport.assignments_updated}{" "}
            updated · {canvasSyncReport.assignments_unchanged} unchanged ·{" "}
            {canvasSyncReport.assignments_archived} archived
          </span>
        </div>
      )}

      {connected && (
        <div className="canvas-course-list" aria-label="Imported Canvas courses">
          <div className="canvas-course-list-heading">
            <strong>Courses</strong>
            <small>{courses.length} imported</small>
          </div>
          {courses.length ? (
            courses.map((course) => (
              <label key={course.id} className="canvas-course-row">
                <input
                  type="checkbox"
                  aria-label={`Sync ${course.name}`}
                  checked={course.selectedForSync ?? true}
                  disabled={busy}
                  onChange={(event) => void updateCourse(course.id, event.target.checked)}
                />
                <span>
                  <strong>{course.name}</strong>
                  <small>
                    {course.assignmentCount ?? 0} assignment
                    {course.assignmentCount === 1 ? "" : "s"}
                    {course.termName ? ` · ${course.termName}` : ""}
                  </small>
                </span>
                <Badge tone={course.concluded ? "neutral" : "success"}>
                  {course.concluded ? "Concluded" : "Active"}
                </Badge>
              </label>
            ))
          ) : (
            <div className="calendar-empty">
              <CheckCircle />
              <p>
                No active courses were returned. This can be normal during summer; enable concluded
                courses and sync to check historical enrollments.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

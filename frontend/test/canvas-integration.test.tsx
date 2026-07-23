import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasIntegrationPanel } from "@/components/canvas/canvas-integration-panel";
import { ApiError } from "@/services/api-client";
import type { CanvasConnectionStatus, CanvasCourse, CanvasSyncReport } from "@/types/canvas";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  sync: vi.fn(),
  setCourseSelection: vi.fn(),
  refreshCanvasWorkspace: vi.fn(),
  state: {
    backendMode: true,
    canvasLoading: false,
    canvasConnection: {
      connected: false,
      configured: false,
      status: "not_configured",
      canvas_display_name: null,
      canvas_user_id: null,
      hostname: null,
      last_verified_at: null,
      last_successful_sync_at: null,
      last_attempted_sync_at: null,
      last_sync_status: null,
      last_error_code: null,
      include_concluded_courses: false,
      data_stale: true,
    },
    canvasSyncReport: null,
    courses: [],
    showToast: vi.fn(),
  } as {
    backendMode: boolean;
    canvasLoading: boolean;
    canvasConnection: CanvasConnectionStatus;
    canvasSyncReport: CanvasSyncReport | null;
    courses: CanvasCourse[];
    showToast: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("@/components/common/app-provider", () => ({
  useApp: () => ({ ...mocks.state, refreshCanvasWorkspace: mocks.refreshCanvasWorkspace }),
}));
vi.mock("@/services/canvas-service", () => ({
  canvasService: {
    verify: mocks.verify,
    sync: mocks.sync,
    setCourseSelection: mocks.setCourseSelection,
  },
}));

beforeEach(() => {
  mocks.verify.mockReset();
  mocks.sync.mockReset();
  mocks.setCourseSelection.mockReset();
  mocks.refreshCanvasWorkspace.mockReset().mockResolvedValue(undefined);
  mocks.state.canvasConnection = {
    connected: false,
    configured: false,
    status: "not_configured",
    canvas_display_name: null,
    canvas_user_id: null,
    hostname: null,
    last_verified_at: null,
    last_successful_sync_at: null,
    last_attempted_sync_at: null,
    last_sync_status: null,
    last_error_code: null,
    include_concluded_courses: false,
    data_stale: true,
  };
  mocks.state.canvasSyncReport = null;
  mocks.state.courses = [];
});

describe("CanvasIntegrationPanel", () => {
  it("explains environment configuration when disconnected", () => {
    render(<CanvasIntegrationPanel />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByText(/managed through the local server environment/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /token/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify connection" })).toBeDisabled();
  });

  it("shows connected identity, stale data, concluded courses, and course selection", async () => {
    const user = userEvent.setup();
    mocks.state.canvasConnection = {
      ...mocks.state.canvasConnection,
      connected: true,
      configured: true,
      status: "connected",
      canvas_display_name: "Canvas Student",
      canvas_user_id: "42",
      hostname: "sequoia.instructure.com",
      last_verified_at: "2026-07-22T12:00:00Z",
      last_successful_sync_at: "2026-07-20T12:00:00Z",
      last_sync_status: "partial",
      include_concluded_courses: true,
      data_stale: true,
    };
    mocks.state.canvasSyncReport = {
      id: "sync",
      status: "partial",
      courses_checked: 2,
      courses_imported: 2,
      assignments_created: 1,
      assignments_updated: 0,
      assignments_unchanged: 0,
      assignments_archived: 0,
      submission_states_updated: 1,
      course_failures: 1,
      warnings: ["Course 2 could not be synchronized."],
      started_at: "2026-07-22T12:00:00Z",
      completed_at: "2026-07-22T12:01:00Z",
      error_code: null,
    };
    mocks.state.courses = [
      {
        id: "course-1",
        name: "Current Biology",
        shortName: "BIO",
        color: "accent",
        canvasCourseId: "1",
        concluded: false,
        selectedForSync: true,
        archived: false,
        assignmentCount: 4,
        lastSeenAt: "2026-07-22T12:00:00Z",
      },
      {
        id: "course-2",
        name: "Past Algebra",
        shortName: "ALG",
        color: "accent",
        canvasCourseId: "2",
        concluded: true,
        selectedForSync: true,
        archived: false,
        assignmentCount: 8,
        lastSeenAt: "2026-07-22T12:00:00Z",
      },
    ];
    mocks.setCourseSelection.mockResolvedValue({});

    render(<CanvasIntegrationPanel />);
    expect(screen.getByText("Canvas Student")).toBeInTheDocument();
    expect(screen.getByText("sequoia.instructure.com")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/partial/i);
    expect(screen.getByText("Past Algebra")).toBeInTheDocument();
    expect(screen.getByText("Concluded")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Sync Current Biology/i }));
    await waitFor(() => expect(mocks.setCourseSelection).toHaveBeenCalledWith("course-1", false));
  });

  it("refreshes stale connection state and presents invalid-token recovery guidance", async () => {
    const user = userEvent.setup();
    mocks.state.canvasConnection = {
      ...mocks.state.canvasConnection,
      connected: true,
      configured: true,
      status: "connected",
      last_error_code: null,
    };
    mocks.verify.mockRejectedValue(
      new ApiError("The Canvas credential is invalid or expired.", 401, {
        error: { code: "invalid_token" },
      }),
    );
    render(<CanvasIntegrationPanel />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify connection" }));
    expect(await screen.findByText(/replace the expired local token/i)).toBeInTheDocument();
    expect(mocks.refreshCanvasWorkspace).toHaveBeenCalled();
  });
});

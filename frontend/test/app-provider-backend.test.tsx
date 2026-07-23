import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "@/components/common/app-provider";
import { assignments as demoAssignments, defaultSettings } from "@/lib/demo-data";

const mocks = vi.hoisted(() => ({
  getAssignments: vi.fn(),
  getBootstrap: vi.fn(),
  getCanvasStatus: vi.fn(),
  authStatus: { value: "authenticated" },
  authUserId: { value: "user-one" },
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useOptionalAuth: () => ({
    status: mocks.authStatus.value,
    user: { id: mocks.authUserId.value },
  }),
}));

vi.mock("@/services", () => ({
  dataMode: "backend",
  services: {
    assignments: { update: vi.fn() },
    settings: { update: vi.fn() },
    canvai: { proposeScheduleChange: vi.fn() },
    insights: { get: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/services/bootstrap-service", () => ({
  bootstrapService: { get: mocks.getBootstrap },
}));

vi.mock("@/services/calendar-service", () => ({
  calendarService: {
    getStatus: vi.fn().mockResolvedValue({ connected: true, status: "connected" }),
  },
}));

vi.mock("@/services/canvas-service", () => ({
  canvasService: {
    getStatus: mocks.getCanvasStatus,
    getCourses: vi
      .fn()
      .mockResolvedValue([
        { id: "canvas-course", name: "Biology", shortName: "BIO", color: "accent" },
      ]),
    getAssignments: mocks.getAssignments,
    getLatestSync: vi.fn().mockResolvedValue(null),
  },
}));

let latestRefresh: (() => Promise<boolean>) | undefined;

const connectedStatus = {
  connected: true,
  configured: true,
  status: "connected",
  include_concluded_courses: false,
};

function Probe() {
  const { assignments, backendMode, canvasError, refreshCanvasWorkspace } = useApp();
  useEffect(() => {
    latestRefresh = refreshCanvasWorkspace;
  }, [refreshCanvasWorkspace]);
  return (
    <div>
      {backendMode
        ? `${assignments.length}:${assignments[0]?.source}:${assignments.at(-1)?.title}`
        : "demo"}
      {canvasError ? `:${canvasError}` : ""}
    </div>
  );
}

beforeEach(() => {
  mocks.authStatus.value = "authenticated";
  mocks.authUserId.value = "user-one";
  latestRefresh = undefined;
  mocks.getBootstrap.mockReset().mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              courses: [],
              assignments: [
                { ...demoAssignments[0], id: "legacy-assignment", title: "Legacy assignment" },
              ],
              sessions: [],
              routine: [],
              workload: [],
              settings: defaultSettings,
              notifications: [],
            }),
          20,
        ),
      ),
  );
  mocks.getCanvasStatus.mockReset().mockResolvedValue(connectedStatus);
  mocks.getAssignments.mockReset();
});

it("hydrates Canvas after bootstrap and loads every assignment page without a race", async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    ...demoAssignments[0],
    id: `canvas-${index}`,
    title: `Canvas assignment ${index}`,
    source: "canvas" as const,
  }));
  mocks.getAssignments.mockImplementation(({ page }: { page?: number }) =>
    Promise.resolve(
      page === 2
        ? {
            assignments: [{ ...firstPage[0], id: "canvas-100", title: "Final Canvas assignment" }],
            total: 101,
            page: 2,
            pageSize: 100,
          }
        : { assignments: firstPage, total: 101, page: 1, pageSize: 100 },
    ),
  );

  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );

  await waitFor(() =>
    expect(screen.getByText("101:canvas:Final Canvas assignment")).toBeInTheDocument(),
  );
  expect(mocks.getAssignments).toHaveBeenCalledTimes(2);
});

it("does not restore stale Canvas data after logout", async () => {
  let resolveAssignments: ((value: object) => void) | undefined;
  mocks.getAssignments.mockReturnValue(
    new Promise((resolve) => {
      resolveAssignments = resolve;
    }),
  );

  const view = render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(mocks.getAssignments).toHaveBeenCalledTimes(1));

  mocks.authStatus.value = "unauthenticated";
  view.rerender(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  resolveAssignments?.({ assignments: [], total: 0, page: 1, pageSize: 100 });

  await waitFor(() => expect(screen.getByText("0:undefined:undefined")).toBeInTheDocument());
});

it("does not let a previous user's refresh overwrite the next user", async () => {
  let resolveFirstUser: ((value: object) => void) | undefined;
  const nextUserAssignment = {
    ...demoAssignments[0],
    id: "next-user-assignment",
    title: "Next user assignment",
    source: "canvas" as const,
  };
  mocks.getAssignments
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirstUser = resolve;
      }),
    )
    .mockResolvedValueOnce({
      assignments: [nextUserAssignment],
      total: 1,
      page: 1,
      pageSize: 100,
    });

  const view = render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(mocks.getAssignments).toHaveBeenCalledTimes(1));

  mocks.authUserId.value = "user-two";
  view.rerender(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText("1:canvas:Next user assignment")).toBeInTheDocument(),
  );

  resolveFirstUser?.({
    assignments: [{ ...nextUserAssignment, id: "old-user", title: "Old user assignment" }],
    total: 1,
    page: 1,
    pageSize: 100,
  });
  await waitFor(() => expect(screen.queryByText(/Old user assignment/)).not.toBeInTheDocument());
  expect(screen.getByText("1:canvas:Next user assignment")).toBeInTheDocument();
});

it("clears the previous user's workspace when the next user's bootstrap fails", async () => {
  mocks.getAssignments.mockResolvedValue({
    assignments: [{ ...demoAssignments[0], source: "canvas" as const }],
    total: 1,
    page: 1,
    pageSize: 100,
  });
  const view = render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByText(/1:canvas:/)).toBeInTheDocument());

  mocks.getBootstrap.mockRejectedValueOnce(new Error("next user unavailable"));
  mocks.authUserId.value = "user-two";
  view.rerender(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );

  expect(screen.getByText("0:undefined:undefined")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("0:undefined:undefined")).toBeInTheDocument());
});

it("treats a superseded refresh failure as cancellation", async () => {
  mocks.getAssignments.mockResolvedValue({ assignments: [], total: 0, page: 1, pageSize: 100 });
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(mocks.getAssignments).toHaveBeenCalled());

  let rejectFirst: ((error: Error) => void) | undefined;
  mocks.getCanvasStatus
    .mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
    )
    .mockResolvedValueOnce(connectedStatus);

  let firstRefresh: Promise<boolean> | undefined;
  await act(async () => {
    firstRefresh = latestRefresh?.();
    await latestRefresh?.();
  });
  rejectFirst?.(new Error("obsolete failure"));
  await act(async () => {
    await expect(firstRefresh).resolves.toBe(false);
  });

  expect(screen.queryByText(/Canvas data could not be refreshed/)).not.toBeInTheDocument();
});

import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppProvider, useApp } from "@/components/common/app-provider";

vi.mock("@/components/auth/auth-provider", () => ({
  useOptionalAuth: () => ({ status: "authenticated" }),
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

vi.mock("@/services/bootstrap-service", async () => {
  const demo = await import("@/lib/demo-data");
  return {
    bootstrapService: {
      get: vi.fn().mockResolvedValue({
        courses: [],
        assignments: [{ ...demo.assignments[0], id: "api-assignment", title: "API assignment" }],
        sessions: [],
        routine: [],
        workload: [],
        settings: demo.defaultSettings,
        notifications: [],
      }),
    },
  };
});

vi.mock("@/services/calendar-service", () => ({
  calendarService: {
    getStatus: vi.fn().mockResolvedValue({ connected: true, status: "connected" }),
  },
}));

function Probe() {
  const { assignments, backendMode } = useApp();
  return <div>{backendMode ? assignments[0]?.title : "demo"}</div>;
}

it("hydrates authenticated backend mode from the API instead of local fixtures", async () => {
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );

  await waitFor(() => expect(screen.getByText("API assignment")).toBeInTheDocument());
});

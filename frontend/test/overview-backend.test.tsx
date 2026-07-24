import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  assignments,
  courses,
  defaultSettings,
  notifications,
  studySessions,
  weeklyWorkload,
} from "@/test/fixtures/demo-data";
import { OverviewPage } from "@/features/dashboard/overview-page";

const { appState } = vi.hoisted(() => ({
  appState: { value: null as Record<string, unknown> | null },
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { display_name: "Backend Student" } }),
}));

vi.mock("@/components/common/app-provider", () => ({
  useApp: () =>
    appState.value ?? {
      backendMode: true,
      loading: false,
      calendarConnection: { connected: true, status: "connected" },
      canvasConnection: { connected: true, status: "connected" },
      assignments,
      courses,
      sessions: studySessions,
      notifications,
      workload: weeklyWorkload,
      settings: defaultSettings,
      showToast: vi.fn(),
      setProposal: vi.fn(),
      proposal: null,
      applyProposal: vi.fn(),
    },
}));

it("renders only metrics computed from the authenticated workspace", () => {
  appState.value = null;
  render(<OverviewPage />);

  expect(screen.queryByRole("button", { name: "Quick add" })).not.toBeInTheDocument();
  expect(screen.getByText("Real workspace")).toBeInTheDocument();
  expect(screen.getByText("Canvas connected")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open planning" })).toHaveAttribute("href", "/canvai");
});

it("renders an all-caught-up state when every imported Canvas assignment is complete", () => {
  const completedAssignments = assignments.map((assignment) => ({
    ...assignment,
    completionState: "completed" as const,
    submissionStatus: "graded" as const,
    source: "canvas" as const,
  }));

  appState.value = {
    backendMode: true,
    loading: false,
    calendarConnection: { connected: true, status: "connected" },
    canvasConnection: { connected: true, status: "connected" },
    assignments: completedAssignments,
    courses,
    sessions: [],
    notifications,
    workload: [],
    settings: defaultSettings,
    showToast: vi.fn(),
    setProposal: vi.fn(),
    proposal: null,
    applyProposal: vi.fn(),
  };

  render(<OverviewPage />);
  expect(screen.getByRole("heading", { name: "You’re all caught up" })).toBeInTheDocument();
});

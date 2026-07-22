import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import {
  assignments,
  courses,
  defaultSettings,
  notifications,
  studySessions,
  weeklyWorkload,
} from "@/lib/demo-data";
import { OverviewPage } from "@/features/dashboard/overview-page";

const { proposeScheduleChange } = vi.hoisted(() => ({
  proposeScheduleChange: vi.fn().mockResolvedValue({
    id: "proposal-api",
    command: "Rebuild the week",
    summary: "Backend proposal",
    reasoning: "Deterministic backend response",
    changes: [],
    status: "preview",
  }),
}));

vi.mock("@/services", () => ({
  services: { canvai: { proposeScheduleChange } },
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { display_name: "Backend Student" } }),
}));

vi.mock("@/components/common/app-provider", () => ({
  useApp: () => ({
    backendMode: true,
    loading: false,
    calendarConnection: { connected: true, status: "connected" },
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
  }),
}));

it("uses the backend Canvai service and hides demo-only assignment creation", async () => {
  const user = userEvent.setup();
  render(<OverviewPage />);

  expect(screen.queryByRole("button", { name: "Quick add" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Rebuild week" }));

  expect(proposeScheduleChange).toHaveBeenCalledWith("Rebuild the week");
});

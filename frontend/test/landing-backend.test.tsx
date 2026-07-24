import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LandingPage } from "@/components/landing/landing-page";

vi.mock("@/components/auth/auth-provider", () => ({
  useOptionalAuth: () => ({
    status: "authenticated",
    user: { id: "user-real" },
  }),
}));

vi.mock("@/components/common/app-provider", () => ({
  useApp: () => ({
    backendMode: true,
    canvasConnection: { configured: true, connected: true },
    calendarConnection: { connected: true },
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/components/common/ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/common/ui")>();
  return {
    ...original,
    ToastRegion: () => null,
  };
});

it("shows authenticated connection state instead of demo status", () => {
  render(<LandingPage />);

  expect(screen.getAllByRole("link", { name: "Open your workspace" }).length).toBeGreaterThan(0);
  expect(screen.getAllByText("● Connected")).toHaveLength(2);
  expect(screen.queryByText(/Demo mode · not connected/i)).not.toBeInTheDocument();
});

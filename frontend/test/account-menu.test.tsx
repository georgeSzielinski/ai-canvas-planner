import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/auth/account-menu";
import { AuthProvider } from "@/components/auth/auth-provider";
import { authService } from "@/lib/auth-service";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

it("provides profile and logout actions for the signed-in account", async () => {
  vi.spyOn(authService, "getSession").mockResolvedValue({
    authenticated: true,
    expires_at: "2026-07-22T00:00:00Z",
    csrf_token: "csrf-123",
    reauthentication_required: false,
  });
  vi.spyOn(authService, "getCurrentUser").mockResolvedValue({
    id: "user-1",
    email: "maya@example.com",
    display_name: "Maya Kessler",
    profile_photo: null,
    timezone: "UTC",
    onboarding_complete: true,
    preferred_theme: "system",
    school_year: "Junior",
    week_starts_on: "monday",
    bedtime: "22:30",
    wake_time: "06:30",
    rowing_schedule: [],
    default_study_duration: 45,
    preferred_calendar: null,
    calendar_consent: true,
    created_at: "2026-07-21T00:00:00Z",
    updated_at: "2026-07-21T00:00:00Z",
  });
  vi.spyOn(authService, "logout").mockResolvedValue({
    status: "logged_out",
    message: "Signed out",
  });

  render(
    <AuthProvider>
      <AccountMenu />
    </AuthProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /maya kessler account menu/i }));

  expect(screen.getByRole("menuitem", { name: /view profile/i })).toHaveAttribute(
    "href",
    "/profile",
  );
  await userEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
  expect(authService.logout).toHaveBeenCalledWith("csrf-123");
});

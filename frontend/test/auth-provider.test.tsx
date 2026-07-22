import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import { authService } from "@/lib/auth-service";
import type { AuthUser, SessionStatus } from "@/types/auth";

const replace = vi.fn();
let pathname = "/overview";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace }),
}));

const session: SessionStatus = {
  authenticated: true,
  expires_at: "2026-07-22T00:00:00Z",
  csrf_token: "csrf-123",
  reauthentication_required: false,
};
const user: AuthUser = {
  id: "user-1",
  email: "maya@example.com",
  display_name: "Maya Kessler",
  profile_photo: null,
  timezone: "America/Los_Angeles",
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
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.status}</span>
      <span>{auth.user?.display_name}</span>
      <span>{auth.sessionMessage}</span>
      <button onClick={() => void auth.logout()}>Log out</button>
    </div>
  );
}

beforeEach(() => {
  replace.mockReset();
  pathname = "/overview";
  vi.restoreAllMocks();
});

describe("global authentication", () => {
  it("hydrates the current user and protects workspace content", async () => {
    vi.spyOn(authService, "getSession").mockResolvedValue(session);
    vi.spyOn(authService, "getCurrentUser").mockResolvedValue(user);

    render(
      <AuthProvider>
        <ProtectedWorkspace>
          <h1>Workspace</h1>
        </ProtectedWorkspace>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByRole("status", { name: /checking your session/i })).toBeInTheDocument();
    expect(await screen.findByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Maya Kessler")).toBeInTheDocument();
  });

  it("redirects signed-out visitors to login with a safe return path", async () => {
    vi.spyOn(authService, "getSession").mockResolvedValue({ ...session, authenticated: false });

    render(
      <AuthProvider>
        <ProtectedWorkspace>
          <h1>Workspace</h1>
        </ProtectedWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Foverview"));
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
  });

  it("sends incomplete accounts to onboarding", async () => {
    vi.spyOn(authService, "getSession").mockResolvedValue(session);
    vi.spyOn(authService, "getCurrentUser").mockResolvedValue({
      ...user,
      onboarding_complete: false,
    });

    render(
      <AuthProvider>
        <ProtectedWorkspace>
          <h1>Workspace</h1>
        </ProtectedWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding?next=%2Foverview"));
  });

  it("clears auth state when the session expires", async () => {
    vi.spyOn(authService, "getSession").mockResolvedValue(session);
    vi.spyOn(authService, "getCurrentUser").mockResolvedValue(user);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("Maya Kessler");

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    });

    expect(
      await screen.findByText("Your session expired. Please sign in again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Maya Kessler")).not.toBeInTheDocument();
  });

  it("logs out using CSRF and returns to login", async () => {
    vi.spyOn(authService, "getSession").mockResolvedValue(session);
    vi.spyOn(authService, "getCurrentUser").mockResolvedValue(user);
    const logout = vi.spyOn(authService, "logout").mockResolvedValue({
      status: "logged_out",
      message: "You have been signed out.",
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("Maya Kessler");
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(logout).toHaveBeenCalledWith("csrf-123");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});

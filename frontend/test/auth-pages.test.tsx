import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/auth/auth-provider";
import { LoginPage } from "@/features/auth/login-page";
import { OnboardingPage } from "@/features/auth/onboarding-page";
import { ProfilePage } from "@/features/auth/profile-page";
import { LegalPage } from "@/features/auth/legal-page";
import { authService, userService } from "@/lib/auth-service";
import type { AuthUser, SessionStatus } from "@/types/auth";

const push = vi.fn();
const replace = vi.fn();
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/login",
  useSearchParams: () => query,
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

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  replace.mockReset();
  query = new URLSearchParams();
});

it("offers Google Sign-In and legal links on the public login page", async () => {
  const getSession = vi
    .spyOn(authService, "getSession")
    .mockResolvedValue({ ...session, authenticated: false });
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );

  expect(screen.getByRole("link", { name: /continue with google/i })).toHaveAttribute(
    "href",
    "http://localhost:8000/api/v1/auth/google/start?remember=true",
  );
  expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  await waitFor(() => expect(getSession).toHaveBeenCalledOnce());
});

it("shows OAuth errors returned to the login page", async () => {
  query = new URLSearchParams("error=access_denied");
  const getSession = vi
    .spyOn(authService, "getSession")
    .mockResolvedValue({ ...session, authenticated: false });
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/could not complete google sign-in/i);
  await waitFor(() => expect(getSession).toHaveBeenCalledOnce());
});

it("submits onboarding preferences with CSRF and opens the workspace", async () => {
  const incomplete = { ...user, onboarding_complete: false };
  vi.spyOn(authService, "getSession").mockResolvedValue(session);
  vi.spyOn(authService, "getCurrentUser").mockResolvedValue(incomplete);
  const complete = vi.spyOn(userService, "completeOnboarding").mockResolvedValue(user);

  render(
    <AuthProvider>
      <OnboardingPage />
    </AuthProvider>,
  );

  await screen.findByRole("heading", { name: /set up your study week/i });
  await userEvent.clear(screen.getByLabelText("School year"));
  await userEvent.type(screen.getByLabelText("School year"), "Junior");
  await userEvent.click(screen.getByRole("button", { name: /finish setup/i }));

  await waitFor(() =>
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        school_year: "Junior",
        timezone: expect.any(String),
        week_starts_on: "monday",
        calendar_consent: false,
      }),
      "csrf-123",
    ),
  );
  expect(push).toHaveBeenCalledWith("/overview");
});

it("updates the authenticated user's profile", async () => {
  vi.spyOn(authService, "getSession").mockResolvedValue(session);
  vi.spyOn(authService, "getCurrentUser").mockResolvedValue(user);
  const update = vi.spyOn(userService, "updateProfile").mockResolvedValue({
    ...user,
    display_name: "Maya Z.",
  });

  render(
    <AuthProvider>
      <ProfilePage />
    </AuthProvider>,
  );
  const name = await screen.findByLabelText("Display name");
  await userEvent.clear(name);
  await userEvent.type(name, "Maya Z.");
  await userEvent.click(screen.getByRole("button", { name: /save profile/i }));

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "Maya Z." }),
      "csrf-123",
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("Profile saved");
});

it("renders public privacy and terms documents", () => {
  const { rerender } = render(<LegalPage kind="privacy" />);
  expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
  expect(screen.getByText(/google account/i)).toBeInTheDocument();

  rerender(<LegalPage kind="terms" />);
  expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
});

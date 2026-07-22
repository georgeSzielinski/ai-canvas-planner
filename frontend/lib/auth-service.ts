import type {
  ActionStatus,
  AuthUser,
  OnboardingUpdate,
  SessionStatus,
  UserUpdate,
} from "@/types/auth";
import { API_BASE_URL, apiClient } from "@/services/api-client";

export const authService = {
  getSession: () => apiClient.request<SessionStatus>("/auth/session"),
  getCurrentUser: () => apiClient.request<AuthUser>("/auth/me"),
  googleSignInUrl: (remember = true, destination?: string | null) => {
    const query = new URLSearchParams({ remember: String(remember) });
    if (destination) query.set("next", destination);
    return `${API_BASE_URL}/auth/google/start?${query.toString()}`;
  },
  logout: (csrfToken: string) =>
    apiClient.request<ActionStatus>("/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
};

export const userService = {
  getProfile: () => apiClient.request<AuthUser>("/user/profile"),
  updateProfile: (update: UserUpdate, csrfToken: string) =>
    apiClient.request<AuthUser>("/user/profile", {
      method: "PATCH",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(update),
    }),
  completeOnboarding: (update: OnboardingUpdate, csrfToken: string) =>
    apiClient.request<AuthUser>("/user/onboarding", {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(update),
    }),
};

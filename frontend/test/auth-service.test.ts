import { afterEach, describe, expect, it, vi } from "vitest";
import { authService, userService } from "@/lib/auth-service";
import { apiClient } from "@/services/api-client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => vi.restoreAllMocks());

describe("authenticated API services", () => {
  it("loads the session with browser credentials", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ authenticated: false, reauthentication_required: false }));

    await authService.getSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/auth/session",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("adds the CSRF token to state-changing user requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: "user-1", display_name: "Maya" }));

    await userService.updateProfile({ display_name: "Maya" }, "csrf-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/user/profile",
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-csrf-token")).toBe("csrf-123");
  });

  it("announces an expired session when an authenticated request returns 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "Session expired" }, 401),
    );
    const expired = vi.fn();
    window.addEventListener("auth:session-expired", expired);

    await expect(apiClient.request("/auth/me")).rejects.toThrow("Session expired");
    expect(expired).toHaveBeenCalledOnce();

    window.removeEventListener("auth:session-expired", expired);
  });
});

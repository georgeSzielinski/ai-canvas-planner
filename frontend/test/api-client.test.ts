import { afterEach, expect, it, vi } from "vitest";
import { ApiClient, setApiCsrfToken } from "@/services/api-client";

afterEach(() => {
  setApiCsrfToken(null);
  vi.unstubAllGlobals();
});

it("includes session cookies in backend requests", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await new ApiClient("http://api.test/api/v1").request("/calendar/status");

  expect(fetchMock).toHaveBeenCalledWith(
    "http://api.test/api/v1/calendar/status",
    expect.objectContaining({
      credentials: "include",
    }),
  );
});

it("adds the CSRF cookie to every mutating backend request", async () => {
  document.cookie = "canvas_sweeper_csrf=test-csrf-token; path=/";
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await new ApiClient("http://api.test/api/v1").request("/assignments/one", {
    method: "PATCH",
    body: JSON.stringify({ status: "done" }),
  });

  const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
  expect(new Headers(request.headers).get("X-CSRF-Token")).toBe("test-csrf-token");
});

it("uses the session CSRF token when the API cookie is on another origin", async () => {
  setApiCsrfToken("session-response-token");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await new ApiClient("https://api.example.test/api/v1").request("/settings", {
    method: "PATCH",
    body: "{}",
  });

  const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
  expect(new Headers(request.headers).get("X-CSRF-Token")).toBe("session-response-token");
});

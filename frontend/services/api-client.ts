export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let sessionCsrfToken: string | null = null;

export function setApiCsrfToken(token: string | null): void {
  sessionCsrfToken = token;
}

export function getApiCsrfToken(): string | null {
  if (sessionCsrfToken) return sessionCsrfToken;
  if (typeof document === "undefined") return null;
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("canvas_sweeper_csrf="))
    ?.slice("canvas_sweeper_csrf=".length);
  return value ? decodeURIComponent(value) : null;
}

export class ApiClient {
  constructor(private readonly baseUrl = API_BASE_URL) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    const csrf = MUTATING_METHODS.has(method) ? getApiCsrfToken() : null;
    if (csrf && !headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrf);
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
      ...init,
      headers,
    });
    if (!response.ok) {
      const details = (await response.json().catch(() => undefined)) as
        { detail?: string; error?: { message?: string } } | undefined;
      const message =
        details?.error?.message ?? details?.detail ?? `Request failed: ${response.status}`;
      if (response.status === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:session-expired", { detail: message }));
      }
      throw new ApiError(message, response.status, details);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();

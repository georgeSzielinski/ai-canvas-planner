import type { AppSettings } from "@/types/domain";
import { apiClient } from "./api-client";

function transformKeys(value: unknown, keyTransform: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => transformKeys(item, keyTransform));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      keyTransform(key),
      transformKeys(item, keyTransform),
    ]),
  );
}

export function settingsFromWire<T = unknown>(value: unknown): T {
  return transformKeys(value, (key) =>
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
  ) as T;
}

export function settingsToWire(value: unknown): unknown {
  return transformKeys(value, (key) =>
    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  );
}

export interface SettingsService {
  get(): Promise<AppSettings>;
  update(settings: AppSettings): Promise<AppSettings>;
}

export const backendSettingsService: SettingsService = {
  get: async () => settingsFromWire<AppSettings>(await apiClient.request<unknown>("/settings")),
  update: async (settings) =>
    settingsFromWire<AppSettings>(
      await apiClient.request<unknown>("/settings", {
        method: "PATCH",
        body: JSON.stringify(settingsToWire(settings)),
      }),
    ),
};

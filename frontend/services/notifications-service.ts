import type { Notification } from "@/types/domain";
import { apiClient } from "./api-client";
import { notificationFromWire, type NotificationWire } from "./bootstrap-service";

export const notificationsService = {
  async list(): Promise<Notification[]> {
    return (await apiClient.request<NotificationWire[]>("/notifications")).map(
      notificationFromWire,
    );
  },
  async markAllRead(): Promise<void> {
    await apiClient.request("/notifications/read-all", { method: "POST" });
  },
  async dismiss(id: string): Promise<void> {
    await apiClient.request(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

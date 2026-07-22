import { insightMetrics } from "@/lib/demo-data";
import type { InsightMetric } from "@/types/domain";
import { apiClient } from "./api-client";

export interface InsightsService {
  get(): Promise<InsightMetric[]>;
}
export const demoInsightsService: InsightsService = {
  async get() {
    return structuredClone(insightMetrics);
  },
};
export const backendInsightsService: InsightsService = {
  get: () => apiClient.request<InsightMetric[]>("/insights"),
};

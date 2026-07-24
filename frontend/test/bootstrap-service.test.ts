import { beforeEach, expect, it, vi } from "vitest";
import { defaultSettings } from "@/test/fixtures/demo-data";
import { bootstrapService } from "@/services/bootstrap-service";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/services/api-client", () => ({
  apiClient: { request },
}));

beforeEach(() => request.mockReset());

it("loads authenticated workspace data without calling the demo bootstrap route", async () => {
  request.mockResolvedValue({
    courses: [],
    assignments: [],
    sessions: [],
    routine: [],
    notifications: [],
    workload: [],
    settings: defaultSettings,
  });

  await expect(bootstrapService.get()).resolves.toMatchObject({ assignments: [], workload: [] });
  expect(request).toHaveBeenCalledWith("/workspace/bootstrap");
  expect(request).not.toHaveBeenCalledWith("/demo/bootstrap");
});

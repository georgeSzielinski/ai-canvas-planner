import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://api.example.test/api/v1",
    },
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile/ },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
      testMatch: /mobile/,
    },
  ],
});

import { expect, test } from "@playwright/test";
import { installAuthenticatedSession } from "./auth-fixture";

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test("landing opens the demo and all main pages navigate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Turn Canvas deadlines/i })).toBeVisible();
  await page
    .getByRole("link", { name: /Open the demo dashboard/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/overview$/);
  for (const [label, path] of [
    ["Assignments", "/assignments"],
    ["Canvai", "/canvai"],
    ["Insights", "/insights"],
    ["Settings", "/settings"],
    ["Overview", "/overview"],
  ] as const) {
    await page.getByRole("link", { name: label }).first().click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("Canvas assignment filters, details, and source status work", async ({ page }) => {
  await page.goto("/assignments");
  await page.getByRole("tab", { name: /All/ }).click();
  await page.getByPlaceholder(/Search assignments/i).fill("Field Lab");
  await page.getByRole("button", { name: /Field Lab/i }).click();
  await expect(page.locator("h2", { hasText: "Field Lab" })).toBeVisible();
  await expect(page.getByText("No due date").first()).toBeVisible();
  await expect(page.getByText("MISSING").first()).toBeVisible();
  await expect(page.getByText("LATE").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Open in Canvas/i })).toHaveAttribute(
    "href",
    "https://sequoia.instructure.com/courses/71/assignments/99",
  );
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(0);
});

test("Canvas connection verification and synchronization use mocked provider data", async ({
  page,
}) => {
  await page.goto("/settings");
  const canvas = page.getByTestId("canvas-integration");
  await expect(canvas.getByText("Maya Canvas")).toBeVisible();
  await expect(canvas.getByText("sequoia.instructure.com")).toBeVisible();
  await expect(canvas.getByText("Biology")).toBeVisible();
  await canvas.getByRole("button", { name: "Verify connection" }).click();
  await expect(page.getByText("Canvas connection verified", { exact: true })).toBeVisible();
  await canvas.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText(/Canvas sync imported 1 new assignment/i)).toBeVisible();
});

test("setting persists across reload", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Maya Playwright");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Maya Playwright");
});

test("Canvai generates a backend preview without silently applying it", async ({ page }) => {
  await page.goto("/canvai");
  await page.getByRole("button", { name: "Protect sleep", exact: true }).click();
  await expect(
    page.getByText("Backend preview generated from the authenticated workspace."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview only in Phase 2" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apply changes" })).toHaveCount(0);
});

test("light and dark themes render without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/overview");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

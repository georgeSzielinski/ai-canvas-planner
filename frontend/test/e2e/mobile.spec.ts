import { expect, test } from "@playwright/test";
import { installAuthenticatedSession } from "./auth-fixture";

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test("mobile navigation keeps primary pages reachable", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: /Good afternoon, Maya/i })).toBeVisible();
  await page.getByRole("link", { name: "Assignments" }).last().click();
  await expect(page).toHaveURL(/\/assignments$/);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByLabel("Application navigation")).toBeVisible();
  await page.getByRole("link", { name: "Canvai" }).first().click();
  await expect(page).toHaveURL(/\/canvai$/);
});

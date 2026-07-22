import { expect, test } from "@playwright/test";

test("anonymous users are redirected from protected workspace routes", async ({ page }) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: false,
        expires_at: null,
        csrf_token: null,
        reauthentication_required: false,
      },
    }),
  );

  await page.goto("/overview");

  await expect(page).toHaveURL(/\/login\?next=%2Foverview$/);
  await expect(page.getByRole("heading", { name: "Sign in to Canvas Sweeper" })).toBeVisible();
});

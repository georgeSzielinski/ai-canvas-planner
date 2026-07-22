import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installAuthenticatedSession } from "./auth-fixture";

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

async function stabilizePage(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
}

test("primary routes have no serious automated accessibility violations", async ({ page }) => {
  const findings: { route: string; id: string; impact: string | null | undefined }[] = [];
  for (const route of ["/", "/overview", "/assignments", "/canvai", "/insights", "/settings"]) {
    await page.goto(route);
    await stabilizePage(page);
    const result = await new AxeBuilder({ page }).analyze();
    findings.push(
      ...result.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => ({ route, id: violation.id, impact: violation.impact })),
    );
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.goto("/overview");
  await stabilizePage(page);
  const darkResult = await new AxeBuilder({ page }).analyze();
  findings.push(
    ...darkResult.violations
      .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
      .map((violation) => ({
        route: "/overview (dark)",
        id: violation.id,
        impact: violation.impact,
      })),
  );
  expect(findings).toEqual([]);
});

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { globSync } from "node:fs";
import { expect, it } from "vitest";

const frontendRoot = resolve(__dirname, "..");

it("contains no production demo data modules, routes, or fallback mode", () => {
  const productionFiles = globSync("{app,components,features,lib,services,types}/**/*.{ts,tsx}", {
    cwd: frontendRoot,
  });
  const forbidden = [
    /lib\/demo-data/,
    /lib\/demo-date/,
    /demoAssignmentsService/,
    /demoCanvaiService/,
    /demoInsightsService/,
    /demoSettingsService/,
    /NEXT_PUBLIC_DATA_MODE/,
    /Open (?:the )?demo/i,
    /Demo mode/i,
    /Maya Kessler/,
    /Demo student/i,
  ];

  const violations = productionFiles.flatMap((file) => {
    const source = readFileSync(resolve(frontendRoot, file), "utf8");
    return forbidden
      .filter((pattern) => pattern.test(source))
      .map((pattern) => `${relative(frontendRoot, file)}: ${pattern}`);
  });

  expect(violations).toEqual([]);
});

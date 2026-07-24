import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AppProvider } from "@/components/common/app-provider";
import { AppShell } from "@/components/app-shell/app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/assignments" }));
vi.mock("@/components/auth/account-menu", () => ({ AccountMenu: () => <span>Account</span> }));

it("renders working application navigation with active route", () => {
  render(
    <AppProvider>
      <AppShell>
        <h1>Test content</h1>
      </AppShell>
    </AppProvider>,
  );
  const links = screen.getAllByRole("link", { name: "Assignments" });
  expect(links[0]).toHaveAttribute("href", "/assignments");
  expect(links[0]).toHaveAttribute("aria-current", "page");
  expect(screen.getAllByRole("link", { name: "Overview" })[0]).toHaveAttribute("href", "/overview");
  expect(screen.getAllByRole("link", { name: "Planning" })[0]).toHaveAttribute("href", "/canvai");
  expect(screen.getAllByRole("link", { name: "Settings" })[0]).toHaveAttribute("href", "/settings");
});

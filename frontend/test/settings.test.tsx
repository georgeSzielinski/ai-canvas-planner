import { render, screen } from "@testing-library/react";
import { AppProvider } from "@/components/common/app-provider";
import { SettingsPage } from "@/features/settings/settings-page";

it("does not fall back to local sample settings without an authenticated account", () => {
  render(
    <AppProvider>
      <SettingsPage />
    </AppProvider>,
  );
  expect(screen.getByRole("status", { name: "Loading settings" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
  expect(localStorage.getItem("canvas-sweeper:settings")).toBeNull();
});

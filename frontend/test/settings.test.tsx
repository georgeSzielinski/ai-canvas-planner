import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/components/common/app-provider";
import { ToastRegion } from "@/components/common/ui";
import { SettingsPage } from "@/features/settings/settings-page";

it("updates and persists settings locally", async () => {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <SettingsPage />
      <ToastRegion />
    </AppProvider>,
  );
  const name = screen.getByLabelText("Display name");
  await user.clear(name);
  await user.type(name, "Maya Test");
  await user.click(screen.getByRole("button", { name: "Save settings" }));
  expect(screen.getByText("Settings saved locally")).toBeInTheDocument();
  expect(localStorage.getItem("canvas-sweeper:settings")).toContain("Maya Test");
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/components/common/app-provider";
import { ToastRegion } from "@/components/common/ui";
import { CanvaiPage } from "@/features/canvai/canvai-page";

it("previews, applies, and undoes a Canvai proposal", async () => {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <CanvaiPage />
      <ToastRegion />
    </AppProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Protect sleep" }));
  expect(await screen.findByText("Lock the study cutoff")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Apply changes" }));
  expect(screen.getByText("Canvai plan applied")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("Plan restored")).toBeInTheDocument();
});

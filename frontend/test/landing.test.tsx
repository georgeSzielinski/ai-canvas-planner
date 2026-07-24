import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/components/common/app-provider";
import { LandingPage } from "@/components/landing/landing-page";

describe("landing page", () => {
  it("renders the product story and requires sign-in instead of sample data", () => {
    render(
      <AppProvider>
        <LandingPage />
      </AppProvider>,
    );
    expect(screen.getByRole("heading", { name: /Turn Canvas deadlines/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Sign in/i })[0]).toHaveAttribute("href", "/login");
    expect(screen.queryByText(/demo dashboard/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/not affiliated with Instructure Canvas or Google/i),
    ).toBeInTheDocument();
  });

  it("switches theme", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <LandingPage />
      </AppProvider>,
    );
    await user.click(screen.getByRole("button", { name: /Switch to dark mode/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("canvas-sweeper:theme")).toBe("dark");
  });
});

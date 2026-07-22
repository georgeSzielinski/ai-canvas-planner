import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/components/common/app-provider";
import { LandingPage } from "@/components/landing/landing-page";

describe("landing page", () => {
  it("renders the product story and demo entry", () => {
    render(
      <AppProvider>
        <LandingPage />
      </AppProvider>,
    );
    expect(screen.getByRole("heading", { name: /Turn Canvas deadlines/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open the demo dashboard/i })[0]).toHaveAttribute(
      "href",
      "/overview",
    );
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

import { render, screen } from "@testing-library/react";
import Page from "@/app/(workspace)/canvai/page";

it("shows a truthful empty planning state before a real draft exists", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { name: "No schedule draft yet" })).toBeInTheDocument();
  expect(screen.getByText(/configure your routines and study preferences/i)).toBeInTheDocument();
});

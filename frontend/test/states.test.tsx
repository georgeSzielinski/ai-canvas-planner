import { render, screen } from "@testing-library/react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/ui";

it("renders polished empty, loading, and error states", () => {
  const { rerender } = render(<EmptyState title="No urgent work" body="Your plan is clear." />);
  expect(screen.getByRole("heading", { name: "No urgent work" })).toBeInTheDocument();
  rerender(<LoadingState />);
  expect(screen.getByRole("status", { name: "Loading demo data" })).toBeInTheDocument();
  rerender(<ErrorState />);
  expect(screen.getByRole("heading", { name: /couldn’t load/i })).toBeInTheDocument();
  expect(screen.getByText(/data has not been changed/i)).toBeInTheDocument();
});

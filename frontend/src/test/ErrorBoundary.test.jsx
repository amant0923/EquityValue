import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../components/ErrorBoundary";

function GoodChild() {
  return <div>Everything is fine</div>;
}

function BadChild() {
  throw new Error("Test error");
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("Everything is fine")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    // Suppress React error boundary console.error noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();

    spy.mockRestore();
  });
});

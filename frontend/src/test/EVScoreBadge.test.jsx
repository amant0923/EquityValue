import { render, screen, act } from "@testing-library/react";
import EVScoreBadge from "../components/EVScoreBadge";

describe("EVScoreBadge", () => {
  beforeEach(() => {
    // Mock requestAnimationFrame to run callbacks synchronously
    let id = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb();
      return ++id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the score number", () => {
    render(<EVScoreBadge score={75} verdict="Buy" />);
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("renders the verdict text", () => {
    render(<EVScoreBadge score={85} verdict="Strong Buy" />);
    expect(screen.getByText("STRONG BUY")).toBeInTheDocument();
  });

  it("applies green color for Strong Buy verdict", () => {
    const { container } = render(<EVScoreBadge score={90} verdict="Strong Buy" />);
    const circles = container.querySelectorAll("circle");
    // Second circle is the progress arc
    expect(circles[1].getAttribute("stroke")).toBe("#22c55e");
  });

  it("applies red color for Strong Sell verdict", () => {
    const { container } = render(<EVScoreBadge score={15} verdict="Strong Sell" />);
    const circles = container.querySelectorAll("circle");
    expect(circles[1].getAttribute("stroke")).toBe("#ef4444");
  });

  it("applies yellow color for Hold verdict", () => {
    const { container } = render(<EVScoreBadge score={50} verdict="Hold" />);
    const circles = container.querySelectorAll("circle");
    expect(circles[1].getAttribute("stroke")).toBe("#eab308");
  });

  it("handles undefined score gracefully", () => {
    const { container } = render(<EVScoreBadge score={undefined} verdict={undefined} />);
    // Should render without crashing
    expect(container.querySelector(".evs-badge")).toBeInTheDocument();
  });

  it("handles null score gracefully", () => {
    const { container } = render(<EVScoreBadge score={null} verdict={null} />);
    expect(container.querySelector(".evs-badge")).toBeInTheDocument();
  });

  it("shows 'Equity Value Score' label for lg size", () => {
    render(<EVScoreBadge score={50} verdict="Hold" size="lg" />);
    expect(screen.getByText("Equity Value Score")).toBeInTheDocument();
  });

  it("hides 'Equity Value Score' label for sm size", () => {
    render(<EVScoreBadge score={50} verdict="Hold" size="sm" />);
    expect(screen.queryByText("Equity Value Score")).not.toBeInTheDocument();
  });
});

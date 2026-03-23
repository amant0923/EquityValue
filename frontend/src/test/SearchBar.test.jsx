import { render, screen, fireEvent } from "@testing-library/react";

// Mock the api module
vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import SearchBar from "../components/SearchBar";
import api from "../lib/api";

describe("SearchBar", () => {
  const defaultProps = {
    ticker: "",
    setTicker: vi.fn(),
    onSearch: vi.fn(),
    loading: false,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders input field with placeholder", () => {
    render(<SearchBar {...defaultProps} />);
    expect(
      screen.getByPlaceholderText(/Search S&P 500/i)
    ).toBeInTheDocument();
  });

  it("renders the Analyse button", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByText("Analyse")).toBeInTheDocument();
  });

  it("calls onSearch when button is clicked", () => {
    const onSearch = vi.fn();
    render(<SearchBar {...defaultProps} ticker="AAPL" onSearch={onSearch} />);
    fireEvent.click(screen.getByText("Analyse"));
    expect(onSearch).toHaveBeenCalledWith("AAPL");
  });

  it("does not call onSearch on Enter when dropdown is closed (no suggestions)", () => {
    const onSearch = vi.fn();
    render(<SearchBar {...defaultProps} ticker="MSFT" onSearch={onSearch} />);
    const input = screen.getByPlaceholderText(/Search S&P 500/i);
    // handleKey returns early when open is false, so Enter does nothing
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("calls setTicker with uppercased value on input change", () => {
    const setTicker = vi.fn();
    render(<SearchBar {...defaultProps} setTicker={setTicker} />);
    const input = screen.getByPlaceholderText(/Search S&P 500/i);
    fireEvent.change(input, { target: { value: "aapl" } });
    expect(setTicker).toHaveBeenCalledWith("AAPL");
  });

  it("disables button when loading", () => {
    render(<SearchBar {...defaultProps} loading={true} ticker="AAPL" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables button when ticker is empty", () => {
    render(<SearchBar {...defaultProps} ticker="" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

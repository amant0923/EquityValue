import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock useAuth before importing the component
const mockUseAuth = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Navigate to detect redirects
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: (props) => {
      mockNavigate(props);
      return null;
    },
  };
});

import ProtectedRoute from "../components/ProtectedRoute";

describe("ProtectedRoute", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when user is authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { id: "123" }, loading: false });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects to '/' when user is NOT authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/", replace: true })
    );
  });

  it("shows loading spinner when auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(container.querySelector(".spinner")).toBeInTheDocument();
  });
});

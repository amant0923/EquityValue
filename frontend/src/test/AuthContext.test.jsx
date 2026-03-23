import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";

// Mock supabase
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: () => mockOnAuthStateChange(),
    },
    from: (...args) => mockFrom(...args),
  },
}));

vi.mock("../lib/features", () => ({
  TIER_LIMITS: {},
  isFeatureAllowed: vi.fn(() => false),
  getFeatureLimit: vi.fn(() => 0),
}));

import { AuthProvider, useAuth } from "../context/AuthContext";

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="user">{auth.user ? auth.user.id : "none"}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="canAnalyse">{String(auth.canAnalyse())}</span>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("provides user state as null when not logged in", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("provides user state when logged in", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
    });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: "user-123",
                plan: "pro",
                analyses_today: 0,
                analyses_total: 0,
                last_analysis_date: new Date().toISOString().slice(0, 10),
              },
              error: null,
            }),
        }),
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("user-123");
  });

  it("canAnalyse returns true for pro user under limit", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-456" } } },
    });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: "user-456",
                plan: "pro",
                analyses_today: 0,
                analyses_total: 0,
                last_analysis_date: today,
              },
              error: null,
            }),
        }),
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("canAnalyse").textContent).toBe("true");
  });

  it("canAnalyse returns false for expired user", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-789" } } },
    });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: "user-789",
                plan: "expired",
                analyses_today: 0,
                analyses_total: 0,
                last_analysis_date: today,
              },
              error: null,
            }),
        }),
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("canAnalyse").textContent).toBe("false");
  });
});

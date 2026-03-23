// Mock supabase before importing api
vi.mock("../lib/supabase", () => ({
  supabase: null,
}));

import api, { getAuthToken } from "../lib/api";

describe("api module", () => {
  it("has a 30000ms timeout configured", () => {
    expect(api.defaults.timeout).toBe(30000);
  });

  it("has baseURL configured", () => {
    // Falls back to localhost when VITE_API_URL is not set
    expect(api.defaults.baseURL).toBe("http://localhost:8000");
  });

  it("does not attach Authorization header when no token is cached", async () => {
    // With supabase mocked as null, _cachedToken stays null
    const config = await api.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("getAuthToken returns null when no token is cached", () => {
    expect(getAuthToken()).toBeNull();
  });
});

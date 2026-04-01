import axios from "axios";
import { supabase } from "./supabase";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 30000,
});

// Cache the access token in memory to avoid calling getSession() on every request.
// Supabase's onAuthStateChange fires whenever the token refreshes or user logs in/out.
let _cachedToken = null;

// Guard flag: when true, ignore token-restoring events (e.g. TOKEN_REFRESHED
// racing with signOut). Must be set by calling clearAuthToken() before signOut.
let _signingOut = false;

if (supabase) {
  // Seed with current session (if any)
  supabase.auth.getSession().then(({ data }) => {
    _cachedToken = data?.session?.access_token || null;
  });

  // Keep token in sync — fires on login, logout, and token refresh
  supabase.auth.onAuthStateChange((event, session) => {
    // While signing out, ignore events that would restore the token
    if (_signingOut && event !== "SIGNED_OUT") return;
    if (event === "SIGNED_OUT") _signingOut = false;
    _cachedToken = session?.access_token || null;
  });
}

api.interceptors.request.use((config) => {
  if (_cachedToken) {
    config.headers.Authorization = `Bearer ${_cachedToken}`;
  }
  return config;
});

export function getAuthToken() {
  return _cachedToken;
}

/**
 * Call before supabase.auth.signOut() to prevent TOKEN_REFRESHED events
 * from restoring the cached token during logout.
 */
export function clearAuthToken() {
  _signingOut = true;
  _cachedToken = null;
}

export default api;

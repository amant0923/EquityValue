import axios from "axios";
import { supabase } from "./supabase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

// Cache the access token in memory to avoid calling getSession() on every request.
// Supabase's onAuthStateChange fires whenever the token refreshes or user logs in/out.
let _cachedToken = null;

if (supabase) {
  // Seed with current session (if any)
  supabase.auth.getSession().then(({ data }) => {
    _cachedToken = data?.session?.access_token || null;
  });

  // Keep token in sync — fires on login, logout, and token refresh
  supabase.auth.onAuthStateChange((_event, session) => {
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

export default api;

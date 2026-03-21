import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { TIER_LIMITS, isFeatureAllowed, getFeatureLimit } from "../lib/features";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const PLANS = {
  trial:   { label: "Trial",   limit: 1 },
  expired: { label: "Expired", limit: 0 },
  pro:     { label: "Pro",     limit: Infinity },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile (plan, usage) from Supabase
  const fetchProfile = async (userId) => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error && error.code === "PGRST116") {
      // No profile yet — create one
      try {
        const { data: newProfile } = await supabase
          .from("user_profiles")
          .insert({ id: userId, plan: "trial", analyses_today: 0, analyses_total: 0, trial_started: new Date().toISOString(), last_analysis_date: new Date().toISOString().slice(0, 10) })
          .select()
          .single();
        return newProfile;
      } catch {
        return { id: userId, plan: "trial", analyses_today: 0, analyses_total: 0 };
      }
    }
    return data;
  };

  // Check and reset daily count if needed
  const getEffectiveProfile = (p) => {
    if (!p) return { plan: "trial", analyses_today: 0, analyses_total: 0, limit: 1 };
    let plan = p.plan;
    // Backward compatibility: map old tier names
    if (plan === "free") plan = "trial";
    if (plan === "max") plan = "pro";
    // Auto-expire trial after 7 days
    if (plan === "trial" && p.trial_started) {
      const trialEnd = new Date(p.trial_started);
      trialEnd.setDate(trialEnd.getDate() + 7);
      if (new Date() > trialEnd) plan = "expired";
    }
    // Also expire if total analyses used up (5 max during trial)
    if (plan === "trial" && (p.analyses_total || 0) >= 5) plan = "expired";
    const today = new Date().toISOString().slice(0, 10);
    const count = p.last_analysis_date === today ? p.analyses_today : 0;
    const planInfo = PLANS[plan] || PLANS.expired;
    return { ...p, plan, analyses_today: count, analyses_total: p.analyses_total || 0, limit: planInfo.limit, planLabel: planInfo.label };
  };

  // Increment analysis count
  const recordAnalysis = async () => {
    if (!supabase || !user) return true; // Allow if no auth
    const today = new Date().toISOString().slice(0, 10);
    const ep = getEffectiveProfile(profile);
    if (ep.plan === "expired") return false;
    if (ep.analyses_today >= ep.limit) return false; // Over limit

    const newCount = ep.last_analysis_date === today ? ep.analyses_today + 1 : 1;
    const newTotal = (ep.analyses_total || 0) + 1;
    const { data } = await supabase
      .from("user_profiles")
      .update({ analyses_today: newCount, analyses_total: newTotal, last_analysis_date: today })
      .eq("id", user.id)
      .select()
      .single();
    if (data) setProfile(data);
    return true;
  };

  const canAnalyse = () => {
    if (!supabase || !user) return true; // No auth = allow
    const ep = getEffectiveProfile(profile);
    if (ep.plan === "expired") return false;
    return ep.analyses_today < ep.limit;
  };

  const isFeatureUnlocked = (feature) => {
    if (!supabase || !user) return false; // No auth = deny access
    const ep = getEffectiveProfile(profile);
    return isFeatureAllowed(ep.plan, feature);
  };

  const getLimit = (feature) => {
    if (!supabase || !user) return 0; // No auth = no access
    const ep = getEffectiveProfile(profile);
    const plan = ep.plan;
    return getFeatureLimit(plan, feature);
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        const p = await fetchProfile(u.id);
        setProfile(p);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        const p = await fetchProfile(u.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    if (!supabase) return { error: { message: "Auth not configured" } };
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  };

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: "Auth not configured" } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    // Always clear local state first — ensures single-click logout even if API fails
    setUser(null);
    setProfile(null);
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // State already cleared above — user is effectively logged out locally
    }
  };

  const getToken = async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;

    // Check if token is expired and try to refresh
    const exp = data?.session?.expires_at;
    if (exp && exp * 1000 < Date.now()) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        return refreshed?.session?.access_token || null;
      } catch {
        // Refresh token expired — force re-login
        await signOut();
        return null;
      }
    }

    return token;
  };

  const trialInfo = () => {
    if (!profile) return null;
    const ep = getEffectiveProfile(profile);
    if (ep.plan !== "trial") return null;
    const trialEnd = new Date(profile.trial_started || Date.now());
    trialEnd.setDate(trialEnd.getDate() + 7);
    const daysLeft = Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24)));
    const analysesLeft = Math.max(0, 5 - (ep.analyses_total || 0));
    return { daysLeft, analysesLeft };
  };

  const value = {
    user,
    profile: profile ? getEffectiveProfile(profile) : null,
    loading,
    signUp,
    signIn,
    signOut,
    recordAnalysis,
    canAnalyse,
    isFeatureUnlocked,
    getLimit,
    getToken,
    trialInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const PLANS = {
  free: { label: "Free", limit: 1 },
  pro:  { label: "Pro",  limit: 5 },
  max:  { label: "Max",  limit: Infinity },
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
      const { data: newProfile } = await supabase
        .from("user_profiles")
        .insert({ id: userId, plan: "free", analyses_today: 0, last_analysis_date: new Date().toISOString().slice(0, 10) })
        .select()
        .single();
      return newProfile;
    }
    return data;
  };

  // Check and reset daily count if needed
  const getEffectiveProfile = (p) => {
    if (!p) return { plan: "free", analyses_today: 0, limit: 1 };
    const today = new Date().toISOString().slice(0, 10);
    const count = p.last_analysis_date === today ? p.analyses_today : 0;
    const planInfo = PLANS[p.plan] || PLANS.free;
    return { ...p, analyses_today: count, limit: planInfo.limit, planLabel: planInfo.label };
  };

  // Increment analysis count
  const recordAnalysis = async () => {
    if (!supabase || !user) return true; // Allow if no auth
    const today = new Date().toISOString().slice(0, 10);
    const ep = getEffectiveProfile(profile);
    if (ep.analyses_today >= ep.limit) return false; // Over limit

    const newCount = ep.last_analysis_date === today ? ep.analyses_today + 1 : 1;
    const { data } = await supabase
      .from("user_profiles")
      .update({ analyses_today: newCount, last_analysis_date: today })
      .eq("id", user.id)
      .select()
      .single();
    if (data) setProfile(data);
    return true;
  };

  const canAnalyse = () => {
    if (!supabase || !user) return true; // No auth = allow
    const ep = getEffectiveProfile(profile);
    return ep.analyses_today < ep.limit;
  };

  const isFeatureUnlocked = (feature) => {
    if (!supabase || !user) return true; // No auth = allow all
    const plan = profile?.plan || "free";
    const FREE_BLOCKED = ["ai_thesis", "monte_carlo", "lbo", "pdf_export", "compare", "screener_full", "intelligence_full", "financials_quarterly"];
    if (plan === "free" && FREE_BLOCKED.includes(feature)) return false;
    return true;
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
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
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
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

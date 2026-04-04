/**
 * Tier-based feature gating configuration.
 *
 * Each tier key maps to the limits/flags that govern what
 * a user on that plan can access throughout the app.
 *
 * NOTE: This is client-side UX gating only. All paid features
 * MUST be enforced server-side (backend middleware / RLS).
 * Client-side checks are easily bypassed and exist solely
 * to provide a smooth user experience, not security.
 */

export const TIER_LIMITS = {
  trial: {
    evs_breakdown: true,        // full depth during trial
    valuation_models_limit: Infinity,
    ai_thesis: false,           // gated — Pro only
    monte_carlo: false,         // gated — Pro only
    lbo: false,                 // gated — Pro only
    watchlist_limit: 3,
    pdf_export: false,          // gated — Pro only
    compare: false,             // gated — Pro only
    compare_limit: 0,
    sector_percentile: true,    // show during trial
    peer_comparison: true,      // show during trial
    screener_full: false,       // basic screener during trial
    intelligence_full: true,    // show during trial
    financials_quarterly: false,
    evs_history: false,         // gated — Pro only
    accuracy_detail: true,      // public page, show it
  },
  expired: {
    evs_breakdown: false,
    valuation_models_limit: 0,
    ai_thesis: false,
    monte_carlo: false,
    lbo: false,
    watchlist_limit: 3,         // keep watchlist visible (read-only scores)
    pdf_export: false,
    compare: false,
    compare_limit: 0,
    sector_percentile: false,
    peer_comparison: false,
    screener_full: false,
    intelligence_full: false,
    financials_quarterly: false,
    evs_history: false,
    accuracy_detail: false,
  },
  pro: {
    evs_breakdown: true,
    valuation_models_limit: Infinity,
    ai_thesis: true,
    monte_carlo: true,
    lbo: true,
    watchlist_limit: Infinity,
    pdf_export: true,
    pdf_limit: Infinity,
    compare: true,
    compare_limit: Infinity,
    sector_percentile: true,
    peer_comparison: true,
    screener_full: true,
    intelligence_full: true,
    financials_quarterly: true,
    evs_history: true,
    accuracy_detail: true,
  },
  lifetime: {
    evs_breakdown: true,
    valuation_models_limit: Infinity,
    ai_thesis: true,
    monte_carlo: true,
    lbo: true,
    watchlist_limit: Infinity,
    pdf_export: true,
    pdf_limit: Infinity,
    compare: true,
    compare_limit: Infinity,
    sector_percentile: true,
    peer_comparison: true,
    screener_full: true,
    intelligence_full: true,
    financials_quarterly: true,
    evs_history: true,
    accuracy_detail: true,
  },
};

/**
 * Check whether a specific feature is unlocked for a given plan.
 * Returns true if the feature flag is truthy in the tier config.
 */
export function isFeatureAllowed(plan, feature) {
  const tier = TIER_LIMITS[plan] || TIER_LIMITS.trial;
  return !!tier[feature];
}

/**
 * Get the numeric limit for a feature on a given plan.
 * Returns the value (number) or 0 if not defined.
 */
export function getFeatureLimit(plan, feature) {
  const tier = TIER_LIMITS[plan] || TIER_LIMITS.trial;
  return tier[feature] ?? 0;
}

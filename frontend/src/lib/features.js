/**
 * Tier-based feature gating configuration.
 *
 * Each tier key maps to the limits/flags that govern what
 * a user on that plan can access throughout the app.
 */

export const TIER_LIMITS = {
  free: {
    evs_breakdown: false,       // top-10 EVS only (handled elsewhere)
    valuation_models_limit: 3,  // show first 3 applicable models
    ai_thesis: false,
    monte_carlo: false,
    lbo: false,
    watchlist_limit: 5,
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
    watchlist_limit: 50,
    pdf_export: true,
    pdf_limit: 5,              // 5 per month
    compare: true,
    compare_limit: 2,
    sector_percentile: true,
    peer_comparison: true,
    screener_full: true,
    intelligence_full: true,
    financials_quarterly: true,
    evs_history: true,
    accuracy_detail: true,
  },
  max: {
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
  const tier = TIER_LIMITS[plan] || TIER_LIMITS.free;
  return !!tier[feature];
}

/**
 * Get the numeric limit for a feature on a given plan.
 * Returns the value (number) or 0 if not defined.
 */
export function getFeatureLimit(plan, feature) {
  const tier = TIER_LIMITS[plan] || TIER_LIMITS.free;
  return tier[feature] ?? 0;
}

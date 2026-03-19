"""
Portfolio Builder — optimisation math and orchestration.

Contains: Ledoit-Wolf shrinkage, GMV / Black-Litterman-EVS / HRP optimizers,
risk profiling, sector templates, stock selection, and build orchestrator.
"""

import math
import numpy as np
from scipy.optimize import minimize
from scipy.cluster.hierarchy import linkage, leaves_list
from scipy.spatial.distance import squareform


# ═══════════════════════════════════════════════════════════════════════
# Task 2 — Ledoit-Wolf shrinkage + Global Minimum Variance
# ═══════════════════════════════════════════════════════════════════════

def ledoit_wolf_shrink(returns: np.ndarray) -> np.ndarray:
    """Ledoit-Wolf shrinkage toward constant-correlation target.

    Parameters
    ----------
    returns : np.ndarray, shape (T, N)
        T observations of N asset returns.

    Returns
    -------
    np.ndarray, shape (N, N)
        Shrunk covariance matrix (symmetric, positive-definite).
    """
    T, N = returns.shape
    # Demean
    X = returns - returns.mean(axis=0)
    # Sample covariance (1/T normalisation for the LW formula)
    sample = (X.T @ X) / T

    # Constant-correlation target
    var = np.diag(sample).copy()
    std = np.sqrt(var)
    # Average pairwise correlation
    corr = sample / np.outer(std, std)
    np.fill_diagonal(corr, 0.0)
    rho_bar = corr.sum() / (N * (N - 1))
    target = rho_bar * np.outer(std, std)
    np.fill_diagonal(target, var)

    # Optimal shrinkage intensity (Ledoit & Wolf 2004, Eq 2)
    # pi — sum of asymptotic variances of sqrt(T)*(s_ij - sigma_ij)
    Y = X ** 2
    phi_mat = (Y.T @ Y) / T - sample ** 2
    phi = phi_mat.sum()

    # rho — sum of asymptotic covariances of sqrt(T)*f_ij with sqrt(T)*s_ij
    # (simplified: use the phi of the diagonal for the target diagonal part)
    rho_diag = np.diag(phi_mat).sum()
    theta_mat = np.zeros((N, N))
    for i in range(N):
        for j in range(N):
            if i != j:
                theta_mat[i, j] = (
                    (X[:, i] ** 2 * X[:, j] * X[:, i]).sum() / T
                    - sample[i, j] * var[i]
                ) / std[i]
    rho_off = (rho_bar / 2.0) * (
        (theta_mat / std[None, :]).sum()
        + (theta_mat.T / std[None, :]).sum()
    )
    rho = rho_diag + rho_off

    # gamma — squared Frobenius distance between sample and target
    gamma = np.sum((target - sample) ** 2)

    # kappa = (phi - rho) / gamma
    kappa = (phi - rho) / gamma if gamma > 0 else 0.0
    delta = max(0.0, min(1.0, kappa / T))

    shrunk = delta * target + (1.0 - delta) * sample
    # Ensure perfect symmetry
    shrunk = (shrunk + shrunk.T) / 2.0
    return shrunk


def optimize_min_variance(cov: np.ndarray, constraints: dict) -> list[float]:
    """Global Minimum Variance portfolio via SLSQP.

    Parameters
    ----------
    cov : np.ndarray, shape (N, N)
    constraints : dict with keys 'min_position' and 'max_position'

    Returns
    -------
    list[float]  — optimal weights, length N
    """
    N = cov.shape[0]
    min_pos = constraints.get("min_position", 0.0)
    max_pos = constraints.get("max_position", 1.0)

    def objective(w):
        return w @ cov @ w

    x0 = np.full(N, 1.0 / N)
    bounds = [(min_pos, max_pos)] * N
    cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    res = minimize(objective, x0, method="SLSQP", bounds=bounds,
                   constraints=cons, options={"maxiter": 1000, "ftol": 1e-12})
    return res.x.tolist()


# ═══════════════════════════════════════════════════════════════════════
# Task 3 — Black-Litterman EVS + Hierarchical Risk Parity
# ═══════════════════════════════════════════════════════════════════════

def optimize_black_litterman_evs(
    cov: np.ndarray,
    evs_scores: list[float],
    constraints: dict,
) -> list[float]:
    """Black-Litterman with EVS as confidence-weighted views.

    Equal-weight prior, tau=0.05.  Maximise mu'w - (delta/2)*w'Sigma*w
    where delta=2.5 (risk aversion).
    """
    N = cov.shape[0]
    tau = 0.05
    delta = 2.5
    min_pos = constraints.get("min_position", 0.0)
    max_pos = constraints.get("max_position", 1.0)

    # Prior: equal-weight implied returns
    w_eq = np.full(N, 1.0 / N)
    pi = delta * cov @ w_eq  # equilibrium excess returns

    # Views: each stock has an absolute view proportional to its EVS
    scores = np.array(evs_scores, dtype=float)
    P = np.eye(N)  # one view per asset
    # View returns: scale EVS to a return view
    # EVS 100 -> +20% expected excess, EVS 0 -> -20%
    Q = (scores - 50.0) / 50.0 * 0.20
    # Confidence: higher EVS certainty -> tighter omega (stronger signal)
    confidence = (scores / 100.0) ** 2
    confidence = np.clip(confidence, 0.05, 1.0)
    omega = np.diag(tau * np.diag(P @ cov @ P.T) / confidence)

    # Posterior mean
    tau_cov = tau * cov
    inv_tau_cov = np.linalg.inv(tau_cov)
    inv_omega = np.linalg.inv(omega)
    M = np.linalg.inv(inv_tau_cov + P.T @ inv_omega @ P)
    mu_bl = M @ (inv_tau_cov @ pi + P.T @ inv_omega @ Q)

    # Optimise: max mu'w - (delta/2)*w'Sigma*w
    def objective(w):
        return -(mu_bl @ w - (delta / 2.0) * w @ cov @ w)

    x0 = np.full(N, 1.0 / N)
    bounds = [(min_pos, max_pos)] * N
    cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    res = minimize(objective, x0, method="SLSQP", bounds=bounds,
                   constraints=cons, options={"maxiter": 1000, "ftol": 1e-12})
    return res.x.tolist()


def optimize_hrp(returns: np.ndarray, constraints: dict) -> list[float]:
    """Hierarchical Risk Parity via recursive bisection.

    Clusters assets by correlation distance, then allocates using
    inverse-variance weighting at each bisection step.
    """
    T, N = returns.shape
    min_pos = constraints.get("min_position", 0.0)
    max_pos = constraints.get("max_position", 1.0)

    cov = np.cov(returns, rowvar=False)
    corr = np.corrcoef(returns, rowvar=False)

    # Correlation distance matrix
    dist = np.sqrt(0.5 * (1.0 - corr))
    np.fill_diagonal(dist, 0.0)
    dist = (dist + dist.T) / 2.0  # ensure symmetry

    # Hierarchical clustering
    condensed = squareform(dist, checks=False)
    link = linkage(condensed, method="single")
    sort_ix = leaves_list(link).tolist()

    # Recursive bisection
    weights = np.ones(N)

    def _bisect(items):
        if len(items) <= 1:
            return
        mid = len(items) // 2
        left = items[:mid]
        right = items[mid:]

        # Inverse-variance of each cluster
        def _cluster_var(indices):
            sub_cov = cov[np.ix_(indices, indices)]
            w_inv = 1.0 / np.diag(sub_cov)
            w_inv /= w_inv.sum()
            return w_inv @ sub_cov @ w_inv

        v_left = _cluster_var(left)
        v_right = _cluster_var(right)
        alpha = 1.0 - v_left / (v_left + v_right)

        weights[left] *= alpha
        weights[right] *= (1.0 - alpha)

        _bisect(left)
        _bisect(right)

    _bisect(sort_ix)

    # Normalise
    weights /= weights.sum()

    # Clip to constraints and re-normalise
    weights = np.clip(weights, min_pos, max_pos)
    weights /= weights.sum()

    return weights.tolist()


# ═══════════════════════════════════════════════════════════════════════
# Task 4 — Risk profiling + sector allocation templates
# ═══════════════════════════════════════════════════════════════════════

PROFILES = [
    "conservative",
    "moderately_conservative",
    "moderate",
    "moderately_aggressive",
    "aggressive",
]

SECTOR_TEMPLATES = {
    "conservative": {
        "Information Technology": 0.08, "Health Care": 0.14,
        "Consumer Staples": 0.19, "Utilities": 0.14,
        "Financials": 0.11, "Industrials": 0.09,
        "Energy": 0.07, "Consumer Discretionary": 0.05,
        "Communication Services": 0.05, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "moderately_conservative": {
        "Information Technology": 0.13, "Health Care": 0.14,
        "Consumer Staples": 0.14, "Utilities": 0.09,
        "Financials": 0.12, "Industrials": 0.11,
        "Energy": 0.07, "Consumer Discretionary": 0.06,
        "Communication Services": 0.06, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "moderate": {
        "Information Technology": 0.23, "Health Care": 0.14,
        "Consumer Staples": 0.09, "Utilities": 0.04,
        "Financials": 0.14, "Industrials": 0.11,
        "Energy": 0.07, "Consumer Discretionary": 0.05,
        "Communication Services": 0.05, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "moderately_aggressive": {
        "Information Technology": 0.28, "Health Care": 0.11,
        "Consumer Staples": 0.04, "Utilities": 0.02,
        "Financials": 0.14, "Industrials": 0.09,
        "Energy": 0.05, "Consumer Discretionary": 0.10,
        "Communication Services": 0.09, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "aggressive": {
        "Information Technology": 0.33, "Health Care": 0.11,
        "Consumer Staples": 0.02, "Utilities": 0.00,
        "Financials": 0.14, "Industrials": 0.09,
        "Energy": 0.05, "Consumer Discretionary": 0.10,
        "Communication Services": 0.09, "Real Estate": 0.04,
        "Basic Materials": 0.03,
    },
}

# Maps thin sectors to their merge target
SECTOR_MERGE_MAP = {
    "Basic Materials": "Industrials",
}

STOCK_COUNT_RANGES = {
    "small": (5, 9),
    "medium": (10, 15),
    "large": (16, 25),
}

# Refine answer adjustments (applied to raw score)
REFINE_ADJUSTMENTS = {
    "emergency_fund": {True: 0, False: -10},
    "debt_level": {"low": 5, "moderate": 0, "high": -10},
    "experience": {"beginner": -5, "intermediate": 0, "advanced": 5},
    "loss_reaction": {"sell_all": -10, "hold": 0, "buy_more": 5},
}

CONSTRAINT_PROFILES = {
    "conservative":            {"max_position": 0.08, "min_position": 0.01},
    "moderately_conservative": {"max_position": 0.09, "min_position": 0.01},
    "moderate":                {"max_position": 0.10, "min_position": 0.01},
    "moderately_aggressive":   {"max_position": 0.12, "min_position": 0.01},
    "aggressive":              {"max_position": 0.15, "min_position": 0.01},
}


def compute_risk_profile(
    sliders: dict,
    refine_answers: dict | None = None,
) -> dict:
    """Compute a risk profile from slider values and optional refine answers.

    sliders: {risk: 1-10, horizon: 1-10, income: 1-10}
    Returns: {score: 1-100, profile: str}
    """
    raw = (
        sliders["risk"] * 0.5
        + sliders["horizon"] * 0.3
        + sliders["income"] * 0.2
    ) * 10.0

    # Apply refine adjustments
    if refine_answers:
        for key, value in refine_answers.items():
            adj_map = REFINE_ADJUSTMENTS.get(key, {})
            raw += adj_map.get(value, 0)

    # Clamp to 1-100
    score = max(1, min(100, round(raw)))

    # Map to profile
    if score <= 20:
        profile = "conservative"
    elif score <= 40:
        profile = "moderately_conservative"
    elif score <= 60:
        profile = "moderate"
    elif score <= 80:
        profile = "moderately_aggressive"
    else:
        profile = "aggressive"

    return {"score": score, "profile": profile}


def get_sector_template(profile: str) -> dict:
    """Return the sector allocation template for a given risk profile."""
    return dict(SECTOR_TEMPLATES[profile])


# ═══════════════════════════════════════════════════════════════════════
# Task 5 — Stock selection + build orchestrator
# ═══════════════════════════════════════════════════════════════════════

def select_stocks(
    sector_template: dict,
    stock_count: str,
    evs_data: list[dict],
) -> list[dict]:
    """Select stocks from evs_data according to sector template and count range.

    Parameters
    ----------
    sector_template : dict  — {sector_name: weight} summing to ~1.0
    stock_count : str       — "small", "medium", or "large"
    evs_data : list[dict]   — each has ticker, sector, score, price

    Returns
    -------
    list[dict] — selected stocks with ticker, sector, score, price
    """
    count_min, count_max = STOCK_COUNT_RANGES[stock_count]
    target_count = (count_min + count_max) // 2

    # Group stocks by sector
    by_sector: dict[str, list[dict]] = {}
    for stock in evs_data:
        sec = stock["sector"]
        by_sector.setdefault(sec, []).append(stock)

    # Sort each sector by EVS score descending
    for sec in by_sector:
        by_sector[sec].sort(key=lambda s: s["score"], reverse=True)

    # Merge thin sectors (sectors with <= 1 stock) via SECTOR_MERGE_MAP
    for thin_sector, merge_target in SECTOR_MERGE_MAP.items():
        if thin_sector in by_sector and len(by_sector[thin_sector]) <= 1:
            merged_stocks = by_sector.pop(thin_sector, [])
            by_sector.setdefault(merge_target, []).extend(merged_stocks)
            # Merge template weights too
            if thin_sector in sector_template:
                w = sector_template.pop(thin_sector, 0.0)
                sector_template[merge_target] = sector_template.get(merge_target, 0.0) + w
            # Re-sort merged sector
            by_sector[merge_target].sort(key=lambda s: s["score"], reverse=True)

    # Allocate stock slots proportionally to sector weights
    selected = []
    active_sectors = {s: w for s, w in sector_template.items() if s in by_sector and w > 0}
    total_w = sum(active_sectors.values()) or 1.0

    for sector, weight in active_sectors.items():
        proportion = weight / total_w
        n_stocks = max(1, round(proportion * target_count))
        available = by_sector.get(sector, [])
        picked = available[:n_stocks]
        selected.extend(picked)

    # Trim or pad to count range
    if len(selected) > count_max:
        # Keep highest EVS
        selected.sort(key=lambda s: s["score"], reverse=True)
        selected = selected[:count_max]
    elif len(selected) < count_min:
        # Pad with remaining highest-EVS stocks not yet selected
        selected_tickers = {s["ticker"] for s in selected}
        remaining = [s for s in evs_data if s["ticker"] not in selected_tickers]
        remaining.sort(key=lambda s: s["score"], reverse=True)
        for stock in remaining:
            if len(selected) >= count_min:
                break
            selected.append(stock)

    return selected


def _build_allocation(
    tickers: list[str],
    evs_data: dict[str, dict],
    returns_data: np.ndarray,
    prices: dict[str, float],
    profile: str,
    investment_amount: float,
    method: str = "auto",
    max_position_override: float | None = None,
) -> dict:
    """Core orchestrator: shrink cov, pick method, compute weights, build allocation.

    Parameters
    ----------
    tickers : list[str]
    evs_data : dict  — {ticker: {score, sector}}
    returns_data : np.ndarray, shape (T, N) — columns aligned to tickers
    prices : dict  — {ticker: current_price}
    profile : str  — risk profile name
    investment_amount : float
    method : str  — "gmv", "bl_evs", "hrp", or "auto"
    max_position_override : float | None

    Returns
    -------
    dict with keys: allocations, risk_metrics, sector_breakdown
    """
    N = len(tickers)
    cov = ledoit_wolf_shrink(returns_data)

    # Constraints — auto-adjust if N is too small for the profile limits
    cp = CONSTRAINT_PROFILES.get(profile, CONSTRAINT_PROFILES["moderate"])
    constraints = dict(cp)
    if max_position_override is not None:
        constraints["max_position"] = max_position_override
    # Ensure feasibility: N * max_pos >= 1.0 and N * min_pos <= 1.0
    if N * constraints["max_position"] < 1.0:
        constraints["max_position"] = 1.0 / N + 0.01
    if N * constraints["min_position"] > 1.0:
        constraints["min_position"] = 1.0 / N - 0.01

    # Auto-select method
    if method == "auto":
        if profile in ("conservative", "moderately_conservative"):
            method = "gmv"
        elif N > 15:
            method = "hrp"
        else:
            method = "bl_evs"

    # Compute weights
    if method == "gmv":
        weights = optimize_min_variance(cov, constraints)
    elif method == "bl_evs":
        evs_scores = [evs_data[t]["score"] for t in tickers]
        weights = optimize_black_litterman_evs(cov, evs_scores, constraints)
    elif method == "hrp":
        weights = optimize_hrp(returns_data, constraints)
    else:
        raise ValueError(f"Unknown method: {method}")

    # Build allocation list
    allocations = []
    for i, ticker in enumerate(tickers):
        w = weights[i]
        price = prices.get(ticker, 0.0)
        shares = math.floor(w * investment_amount / price) if price > 0 else 0
        allocations.append({
            "ticker": ticker,
            "weight": w,
            "shares": shares,
            "avg_price": price,
            "sector": evs_data[ticker]["sector"],
            "evs_score": evs_data[ticker]["score"],
        })

    # Risk metrics
    w_arr = np.array(weights)
    port_var = float(w_arr @ cov @ w_arr)
    port_vol = float(np.sqrt(port_var * 252))  # annualised

    risk_metrics = {
        "portfolio_variance": port_var,
        "portfolio_volatility_annual": port_vol,
        "method": method,
        "profile": profile,
    }

    # Sector breakdown
    sector_breakdown: dict[str, float] = {}
    for alloc in allocations:
        sec = alloc["sector"]
        sector_breakdown[sec] = sector_breakdown.get(sec, 0.0) + alloc["weight"]

    return {
        "allocations": allocations,
        "risk_metrics": risk_metrics,
        "sector_breakdown": sector_breakdown,
    }

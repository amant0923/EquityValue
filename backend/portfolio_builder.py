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

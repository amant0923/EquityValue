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

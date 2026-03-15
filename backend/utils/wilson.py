import math


def wilson_confidence_interval(p: float, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for binomial proportion at 95% confidence.

    Args:
        p: observed proportion (0-1)
        n: sample size
        z: z-score (1.96 for 95% CI)

    Returns:
        (lower_bound, upper_bound) as floats between 0 and 1
    """
    if n == 0:
        return (0.0, 1.0)

    denominator = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denominator
    margin = (z / denominator) * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))

    lower = max(0.0, center - margin)
    upper = min(1.0, center + margin)

    return (round(lower, 4), round(upper, 4))

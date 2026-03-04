def classify_company(data: dict) -> str:
    sector     = data.get("sector", "")
    div_yield  = data.get("dividend_yield") or 0
    rev_growth = data.get("revenue_growth") or 0
    fcf        = data.get("free_cashflow") or 0
    eps        = data.get("eps") or 0
    ebitda     = data.get("ebitda") or 0

    if sector in ("Financial Services", "Insurance", "Banks"):
        return "financial"
    if div_yield >= 0.02 and eps > 0 and rev_growth < 0.15:
        return "dividend"
    if rev_growth >= 0.15 and (fcf > 0 or eps > 0):
        return "profitable_growth"
    if rev_growth >= 0.10 and (fcf <= 0 or eps <= 0):
        return "high_growth_unprofitable"
    if sector in ("Energy", "Industrials", "Materials", "Utilities") and ebitda > 0:
        return "cyclical"
    return "profitable_growth"


COMPANY_TYPE_LABELS = {
    "dividend":                 "Dividend / Value",
    "profitable_growth":        "Profitable Growth",
    "high_growth_unprofitable": "High Growth (Pre-Profit)",
    "cyclical":                 "Cyclical / Industrial",
    "financial":                "Financial / Bank",
}

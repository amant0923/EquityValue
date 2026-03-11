"""Shared test fixtures for valuation tests."""
import pytest


@pytest.fixture
def sample_stock_data():
    """Minimal stock data dict matching data_fetcher output."""
    return {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "price": 175.0,
        "current_price": 175.0,
        "eps": 6.50,
        "ebitda": 130_000_000_000,
        "revenue": 390_000_000_000,
        "free_cashflow": 100_000_000_000,
        "shares_outstanding": 15_500_000_000,
        "total_debt": 110_000_000_000,
        "cash": 60_000_000_000,
        "total_cash": 60_000_000_000,
        "market_cap": 2_700_000_000_000,
        "enterprise_value": 2_750_000_000_000,
        "book_value": 4.25,
        "book_value_per_share": 4.25,
        "beta": 1.2,
        "roe": 0.45,
        "roa": 0.28,
        "dividend_yield": 0.005,
        "profit_margin": 0.25,
        "operating_margin": 0.30,
        "revenue_growth": 0.08,
        "earnings_growth": 0.10,
        "sector": "Technology",
        "industry": "Consumer Electronics",
        "pe_ratio": 26.9,
        "pb_ratio": 41.0,
        "ps_ratio": 7.0,
        "ev_ebitda": 21.0,
        "ev_to_ebitda": 21.0,
        "52w_high": 200.0,
        "52w_low": 140.0,
        "target_price": 195.0,
        "recommendation": "buy",
        "analyst_count": 35,
        "operating_income": 115_000_000_000,
        "depreciation_amortization": 15_000_000_000,
        "total_assets": 350_000_000_000,
        "total_assets_prev": 340_000_000_000,
        "ebitda_prev": 125_000_000_000,
        "eps_3yr_avg": 6.20,
        "roe_3yr_avg": 0.43,
        "payout_ratio": 0.15,
        "interest_expense": 3_500_000_000,
    }


@pytest.fixture
def sample_sector_multiples():
    """Sector multiples dict as returned by get_sector_multiples()."""
    return {
        "Technology": {
            "ev_ebitda": 22.0,
            "ev_ebit": 25.0,
            "ev_sales": 6.5,
            "pe": 28.0,
            "ps": 6.0,
            "pb": 8.0,
            "fcf_yield": 0.035,
            "cap_rate": 0.06,
            "median_growth": 0.10,
        },
        "default": {
            "ev_ebitda": 16.0,
            "ev_ebit": 18.0,
            "ev_sales": 2.5,
            "pe": 18.0,
            "ps": 2.0,
            "pb": 3.0,
            "fcf_yield": 0.045,
            "cap_rate": 0.08,
            "median_growth": 0.06,
        },
    }

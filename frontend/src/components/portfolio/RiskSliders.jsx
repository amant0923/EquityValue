import { useState } from "react";
import "./RiskSliders.css";

const SLIDERS = [
  { key: "risk_tolerance", label: "Risk Tolerance", left: "Conservative", right: "Aggressive" },
  { key: "investment_horizon", label: "Investment Horizon", left: "1 year", right: "10+ years" },
  { key: "income_preference", label: "Income Preference", left: "Dividends", right: "Growth" },
];

const REFINE_QUESTIONS = [
  {
    key: "drop_reaction",
    label: "If your portfolio dropped 20% in a month, what would you do?",
    options: [
      { value: "hold", label: "Hold steady" },
      { value: "buy_more", label: "Buy more" },
      { value: "sell_some", label: "Sell some" },
      { value: "sell_all", label: "Sell all" },
    ],
  },
  {
    key: "net_worth_pct",
    label: "What percentage of your net worth will this portfolio represent?",
    options: [
      { value: "under_10", label: "Under 10%" },
      { value: "10_to_30", label: "10-30%" },
      { value: "30_to_50", label: "30-50%" },
      { value: "over_50", label: "Over 50%" },
    ],
  },
  {
    key: "goal",
    label: "What is your primary investment goal?",
    options: [
      { value: "preserve", label: "Preserve capital" },
      { value: "income", label: "Generate income" },
      { value: "balanced", label: "Balanced growth" },
      { value: "max_growth", label: "Maximum growth" },
    ],
  },
];

export default function RiskSliders({ sliders, onSlidersChange, refine, onRefineChange }) {
  const [showRefine, setShowRefine] = useState(false);

  const handleSlider = (key, value) => {
    onSlidersChange({ ...sliders, [key]: Number(value) });
  };

  const handleRefine = (key, value) => {
    onRefineChange({ ...refine, [key]: value });
  };

  return (
    <div className="risk-sliders">
      {SLIDERS.map((s) => (
        <div key={s.key} className="slider-row">
          <div className="slider-row__header">
            <span className="slider-row__label">{s.label}</span>
            <span className="slider-row__value">{sliders[s.key] || 5}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={sliders[s.key] || 5}
            onChange={(e) => handleSlider(s.key, e.target.value)}
            aria-label={s.label}
          />
          <div className="slider-row__range-labels">
            <span>{s.left}</span>
            <span>{s.right}</span>
          </div>
        </div>
      ))}

      <button
        className="refine-toggle"
        onClick={() => setShowRefine(!showRefine)}
        type="button"
      >
        <span className={`refine-toggle__arrow${showRefine ? " open" : ""}`}>&#9654;</span>
        Refine your profile (optional)
      </button>

      {showRefine && (
        <div className="refine-section">
          {REFINE_QUESTIONS.map((q) => (
            <div key={q.key}>
              <div className="refine-question__label">{q.label}</div>
              <div className="refine-question__options">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`refine-btn${refine[q.key] === opt.value ? " active" : ""}`}
                    onClick={() => handleRefine(q.key, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

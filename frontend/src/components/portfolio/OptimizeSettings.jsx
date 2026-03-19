import "./OptimizeSettings.css";

export default function OptimizeSettings({
  method,
  onMethodChange,
  maxPosition,
  onMaxPositionChange,
  stockCount,
}) {
  const hrpDisabled = stockCount != null && stockCount <= 15;

  return (
    <div className="optimize-settings">
      <div>
        <div className="optimize-settings__section-label">Optimization Method</div>
        <div className="optimize-settings__methods">
          <button
            type="button"
            className={`optimize-settings__method-btn${method === "mean_variance" ? " active" : ""}`}
            onClick={() => onMethodChange("mean_variance")}
          >
            Mean-Variance
          </button>
          <button
            type="button"
            className={`optimize-settings__method-btn${method === "hrp" ? " active" : ""}`}
            onClick={() => !hrpDisabled && onMethodChange("hrp")}
            disabled={hrpDisabled}
          >
            HRP
          </button>
        </div>
        {hrpDisabled && (
          <div className="optimize-settings__hint">
            HRP requires more than 15 stocks
          </div>
        )}
      </div>

      <div>
        <div className="optimize-settings__slider-header">
          <span className="optimize-settings__slider-label">Max Position Size</span>
          <span className="optimize-settings__slider-value">{maxPosition}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={25}
          step={1}
          value={maxPosition}
          onChange={(e) => onMaxPositionChange(Number(e.target.value))}
          aria-label="Maximum position size percentage"
        />
        <div className="optimize-settings__slider-range">
          <span>5%</span>
          <span>25%</span>
        </div>
      </div>
    </div>
  );
}

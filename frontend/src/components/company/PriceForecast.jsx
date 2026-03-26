import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LineChart,
} from "recharts";

const fmt = (v, d = 2) => (v != null ? Number(v).toFixed(d) : "-");

const PriceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: "0.75rem",
        color: "var(--text)",
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {d?.price != null && (
        <Row label="Price" value={`$${fmt(d.price)}`} color="var(--primary)" />
      )}
      {d?.predicted != null && (
        <Row label="Forecast" value={`$${fmt(d.predicted)}`} color="#e08830" />
      )}
      {d?.upper_95 != null && (
        <Row
          label="95% CI"
          value={`$${fmt(d.lower_95)} - $${fmt(d.upper_95)}`}
          color="var(--green2)"
        />
      )}
    </div>
  );
};

const VolTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: "0.75rem",
        color: "var(--text)",
        minWidth: 150,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {d?.volatility != null && (
        <Row
          label="Volatility"
          value={`${(d.volatility * 100).toFixed(2)}%`}
          color="#9b59b6"
        />
      )}
      {d?.predicted_vol != null && (
        <Row
          label="Forecast Vol"
          value={`${(d.predicted_vol * 100).toFixed(2)}%`}
          color="#e08830"
        />
      )}
    </div>
  );
};

function Row({ label, value, color }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 2,
      }}
    >
      <span style={{ color: "var(--text3)" }}>{label}:</span>
      <span className="mono" style={{ fontWeight: 600, color }}>
        {value}
      </span>
    </div>
  );
}

export default function PriceForecast({ data }) {
  if (!data) return null;

  const { price_forecast, volatility_forecast, model_params } = data;

  /* --- Price chart data --- */
  const priceChartData = [];

  (price_forecast?.historical || []).forEach((d) => {
    priceChartData.push({
      date: d.date,
      price: d.price,
      predicted: null,
      lower_95: null,
      upper_95: null,
    });
  });

  (price_forecast?.forecast || []).forEach((d) => {
    priceChartData.push({
      date: d.date,
      price: null,
      predicted: d.predicted,
      lower_95: d.lower_95,
      upper_95: d.upper_95,
    });
  });

  /* Connect last historical point to first forecast */
  const hist = price_forecast?.historical;
  const fc = price_forecast?.forecast;
  if (hist?.length && fc?.length) {
    const lastHist = hist[hist.length - 1];
    /* Add a bridge point that has both price and predicted */
    const bridgeIdx = priceChartData.findIndex((d) => d.date === lastHist.date);
    if (bridgeIdx >= 0) {
      priceChartData[bridgeIdx].predicted = lastHist.price;
      priceChartData[bridgeIdx].lower_95 = lastHist.price;
      priceChartData[bridgeIdx].upper_95 = lastHist.price;
    }
  }

  priceChartData.sort((a, b) => new Date(a.date) - new Date(b.date));

  /* --- Volatility chart data --- */
  const volChartData = [];

  (volatility_forecast?.historical || []).forEach((d) => {
    volChartData.push({ date: d.date, volatility: d.volatility, predicted_vol: null });
  });

  (volatility_forecast?.forecast || []).forEach((d) => {
    volChartData.push({ date: d.date, volatility: null, predicted_vol: d.predicted_vol });
  });

  /* Bridge last historical vol to first forecast */
  const volHist = volatility_forecast?.historical;
  const volFc = volatility_forecast?.forecast;
  if (volHist?.length && volFc?.length) {
    const lastVolHist = volHist[volHist.length - 1];
    const bridgeIdx = volChartData.findIndex((d) => d.date === lastVolHist.date);
    if (bridgeIdx >= 0) {
      volChartData[bridgeIdx].predicted_vol = lastVolHist.volatility;
    }
  }

  volChartData.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
      <style>{`
        .forecast-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 12px;
        }
        .forecast-section-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text3);
          margin-bottom: 8px;
          margin-top: 20px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .model-info-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .model-info-chip {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 0.7rem;
        }
        .model-info-label {
          color: var(--text3);
          margin-right: 6px;
        }
        .model-info-value {
          font-weight: 700;
          color: var(--text);
          font-family: "SF Mono", "Fira Code", monospace;
        }
      `}</style>

      <div className="forecast-title">Price & Volatility Forecast</div>

      {/* Price Forecast Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={priceChartData}
          margin={{ top: 8, right: 12, bottom: 4, left: -4 }}
        >
          <defs>
            <linearGradient id="ciBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--green2)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--green2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.3}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip content={<PriceTooltip />} />
          <Legend
            iconType="line"
            wrapperStyle={{ fontSize: 10, color: "var(--text3)" }}
          />

          {/* 95% confidence band */}
          <Area
            dataKey="upper_95"
            stroke="none"
            fill="url(#ciBand)"
            name="95% CI Upper"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="lower_95"
            stroke="none"
            fill="var(--surface)"
            name="95% CI Lower"
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Historical price */}
          <Line
            dataKey="price"
            name="Historical Price"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Forecast */}
          <Line
            dataKey="predicted"
            name="Forecast"
            stroke="#e08830"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volatility Forecast */}
      <div className="forecast-section-label">Volatility Forecast</div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={volChartData}
          margin={{ top: 4, right: 12, bottom: 0, left: -10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.3}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v) => (v * 100).toFixed(1) + "%"}
          />
          <Tooltip content={<VolTooltip />} />
          <Legend
            iconType="line"
            wrapperStyle={{ fontSize: 10, color: "var(--text3)" }}
          />
          <Line
            dataKey="volatility"
            name="Historical Vol"
            stroke="#9b59b6"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            dataKey="predicted_vol"
            name="Forecast Vol"
            stroke="#e08830"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Model Info */}
      {model_params && (
        <div className="model-info-row">
          {model_params.arima_order && (
            <div className="model-info-chip">
              <span className="model-info-label">ARIMA:</span>
              <span className="model-info-value">
                ({model_params.arima_order.join(", ")})
              </span>
            </div>
          )}
          {model_params.garch_order && (
            <div className="model-info-chip">
              <span className="model-info-label">GARCH:</span>
              <span className="model-info-value">
                ({model_params.garch_order.join(", ")})
              </span>
            </div>
          )}
          {model_params.aic != null && (
            <div className="model-info-chip">
              <span className="model-info-label">AIC:</span>
              <span className="model-info-value">{fmt(model_params.aic, 1)}</span>
            </div>
          )}
          {model_params.bic != null && (
            <div className="model-info-chip">
              <span className="model-info-label">BIC:</span>
              <span className="model-info-value">{fmt(model_params.bic, 1)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

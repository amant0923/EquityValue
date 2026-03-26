import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ComposedChart,
  Bar,
  Area,
  AreaChart,
  BarChart,
  Legend,
} from "recharts";

const TABS = [
  { key: "ma", label: "Moving Averages" },
  { key: "rsi_macd", label: "RSI + MACD" },
  { key: "boll_vol", label: "Bollinger + Volume" },
  { key: "fib_pivot", label: "Fibonacci + Pivots" },
  { key: "supertrend", label: "Supertrend" },
];

const MA_LINES = [
  { key: "sma_20", label: "SMA 20", color: "#ff9800", source: "sma", period: "20" },
  { key: "sma_50", label: "SMA 50", color: "#2196f3", source: "sma", period: "50" },
  { key: "sma_200", label: "SMA 200", color: "#9c27b0", source: "sma", period: "200" },
  { key: "ema_21", label: "EMA 21", color: "#00bcd4", source: "ema", period: "21" },
  { key: "ema_50", label: "EMA 50", color: "#4caf50", source: "ema", period: "50" },
  { key: "ema_200", label: "EMA 200", color: "#e91e63", source: "ema", period: "200" },
];

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[dt.getMonth()]} ${dt.getDate()}`;
};

const fmtPrice = (v) => (v != null ? `$${Number(v).toFixed(2)}` : "");

const tooltipStyle = {
  background: "var(--surface2, var(--surface))",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const xAxisProps = {
  dataKey: "date",
  tickFormatter: fmtDate,
  tick: { fill: "var(--text3)", fontSize: 10 },
  axisLine: { stroke: "var(--border)" },
  tickLine: false,
  minTickGap: 40,
};

const yAxisPrice = {
  tick: { fill: "var(--text3)", fontSize: 10 },
  tickFormatter: fmtPrice,
  axisLine: false,
  tickLine: false,
  width: 65,
  domain: ["auto", "auto"],
};

export default function TechnicalAnalysis({ data }) {
  const [tab, setTab] = useState("ma");
  const [maVisible, setMaVisible] = useState({ sma_50: true, ema_21: true });

  // Merge price OHLC data into flat array
  const priceData = useMemo(() => {
    if (!data?.price) return [];
    return data.price.map((p) => ({
      date: p.date || p.t,
      close: p.close || p.c,
      open: p.open || p.o,
      high: p.high || p.h,
      low: p.low || p.l,
    }));
  }, [data?.price]);

  // Moving averages merged with price
  const maData = useMemo(() => {
    if (!priceData.length) return [];
    const sma = data.sma || {};
    const ema = data.ema || {};
    return priceData.map((p, i) => {
      const row = { ...p };
      MA_LINES.forEach((ml) => {
        const src = ml.source === "sma" ? sma : ema;
        const arr = src[ml.period] || src[`sma_${ml.period}`] || src[`ema_${ml.period}`] || [];
        if (arr[i] != null) row[ml.key] = arr[i];
      });
      return row;
    });
  }, [priceData, data?.sma, data?.ema]);

  // RSI data
  const rsiData = useMemo(() => {
    if (!data?.rsi || !priceData.length) return [];
    return priceData.map((p, i) => ({
      date: p.date,
      rsi: data.rsi[i] != null ? data.rsi[i] : null,
    }));
  }, [priceData, data?.rsi]);

  // MACD data
  const macdData = useMemo(() => {
    if (!data?.macd || !priceData.length) return [];
    const m = data.macd;
    return priceData.map((p, i) => ({
      date: p.date,
      macd: m.macd?.[i] ?? null,
      signal: m.signal?.[i] ?? null,
      histogram: m.histogram?.[i] ?? null,
    }));
  }, [priceData, data?.macd]);

  // Bollinger data merged with price
  const bollingerData = useMemo(() => {
    if (!data?.bollinger || !priceData.length) return [];
    const b = data.bollinger;
    return priceData.map((p, i) => ({
      ...p,
      upper: b.upper?.[i] ?? null,
      middle: b.middle?.[i] ?? null,
      lower: b.lower?.[i] ?? null,
    }));
  }, [priceData, data?.bollinger]);

  // Volume data
  const volumeData = useMemo(() => {
    if (!data?.volume || !priceData.length) return [];
    return priceData.map((p, i) => ({
      date: p.date,
      volume: data.volume[i] ?? null,
    }));
  }, [priceData, data?.volume]);

  // Supertrend data merged with price
  const supertrendData = useMemo(() => {
    if (!data?.supertrend || !priceData.length) return [];
    const st = data.supertrend;
    return priceData.map((p, i) => {
      const dir = st.direction?.[i];
      const val = st.value?.[i] ?? st.supertrend?.[i] ?? null;
      return {
        ...p,
        st_green: dir === 1 && val != null ? val : null,
        st_red: dir === -1 && val != null ? val : null,
      };
    });
  }, [priceData, data?.supertrend]);

  const toggleMa = (key) =>
    setMaVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      {/* Tab bar */}
      <div className="ta-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`ta-tab${tab === t.key ? " ta-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Moving Averages */}
      {tab === "ma" && (
        <div>
          <div className="ta-toggles">
            {MA_LINES.map((ml) => (
              <label key={ml.key} className="ta-check">
                <input
                  type="checkbox"
                  checked={!!maVisible[ml.key]}
                  onChange={() => toggleMa(ml.key)}
                />
                <span style={{ color: ml.color, fontWeight: 600 }}>{ml.label}</span>
              </label>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={maData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisPrice} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtPrice(v), n]} labelFormatter={fmtDate} />
              <Line
                type="monotone"
                dataKey="close"
                stroke="var(--primary)"
                strokeWidth={1.5}
                dot={false}
                name="Price"
              />
              {MA_LINES.map(
                (ml) =>
                  maVisible[ml.key] && (
                    <Line
                      key={ml.key}
                      type="monotone"
                      dataKey={ml.key}
                      stroke={ml.color}
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="4 2"
                      name={ml.label}
                      connectNulls
                    />
                  )
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* RSI + MACD */}
      {tab === "rsi_macd" && (
        <div>
          <div style={{ marginBottom: 8, fontSize: "0.8rem", fontWeight: 600, color: "var(--text3)" }}>
            RSI (14)
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={rsiData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis {...xAxisProps} />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                domain={[0, 100]}
                ticks={[30, 50, 70]}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtDate} formatter={(v) => [v?.toFixed(1), "RSI"]} />
              <ReferenceLine y={70} stroke="#f44336" strokeDasharray="4 3" strokeWidth={1} />
              <ReferenceLine y={30} stroke="#4caf50" strokeDasharray="4 3" strokeWidth={1} />
              <Line type="monotone" dataKey="rsi" stroke="var(--primary)" strokeWidth={1.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 16, marginBottom: 8, fontSize: "0.8rem", fontWeight: 600, color: "var(--text3)" }}>
            MACD
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={macdData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis {...xAxisProps} />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={(v) => v?.toFixed(1)}
              />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtDate} formatter={(v, n) => [v?.toFixed(2), n]} />
              <Bar dataKey="histogram" name="Histogram" fill="var(--primary2)" opacity={0.5} />
              <Line type="monotone" dataKey="macd" stroke="#2196f3" strokeWidth={1.5} dot={false} name="MACD" connectNulls />
              <Line type="monotone" dataKey="signal" stroke="#ff9800" strokeWidth={1.5} dot={false} name="Signal" connectNulls />
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bollinger + Volume */}
      {tab === "boll_vol" && (
        <div>
          <div style={{ marginBottom: 8, fontSize: "0.8rem", fontWeight: 600, color: "var(--text3)" }}>
            Bollinger Bands (20, 2)
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={bollingerData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisPrice} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtPrice(v), n]} labelFormatter={fmtDate} />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="var(--primary)"
                fillOpacity={0.06}
                name="Upper Band"
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#fff"
                fillOpacity={1}
                name="Lower Band"
                connectNulls
              />
              <Line type="monotone" dataKey="upper" stroke="var(--primary)" strokeWidth={1} dot={false} strokeDasharray="3 2" name="Upper" connectNulls />
              <Line type="monotone" dataKey="lower" stroke="var(--primary)" strokeWidth={1} dot={false} strokeDasharray="3 2" name="Lower" connectNulls />
              <Line type="monotone" dataKey="middle" stroke="var(--primary2)" strokeWidth={1} dot={false} strokeDasharray="5 3" name="Middle" connectNulls />
              <Line type="monotone" dataKey="close" stroke="var(--text)" strokeWidth={1.5} dot={false} name="Price" />
            </ComposedChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.8rem", fontWeight: 600, color: "var(--text3)" }}>
            Volume
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={volumeData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis {...xAxisProps} />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                tickFormatter={(v) => {
                  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
                  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
                  return v;
                }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={fmtDate}
                formatter={(v) => [v?.toLocaleString(), "Volume"]}
              />
              <Bar dataKey="volume" fill="var(--primary2)" opacity={0.6} name="Volume" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Fibonacci + Pivots */}
      {tab === "fib_pivot" && (
        <FibPivotTab priceData={priceData} fibonacci={data.fibonacci} pivotPoints={data.pivot_points} />
      )}

      {/* Supertrend */}
      {tab === "supertrend" && (
        <div>
          <div style={{ marginBottom: 8, fontSize: "0.8rem", fontWeight: 600, color: "var(--text3)" }}>
            Supertrend (10, 3)
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={supertrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisPrice} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtPrice(v), n]} labelFormatter={fmtDate} />
              <Line type="monotone" dataKey="close" stroke="var(--primary)" strokeWidth={1.5} dot={false} name="Price" />
              <Line
                type="monotone"
                dataKey="st_green"
                stroke="#4caf50"
                strokeWidth={2}
                dot={false}
                name="Bullish"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="st_red"
                stroke="#f44336"
                strokeWidth={2}
                dot={false}
                name="Bearish"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: "0.75rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 16, height: 3, background: "#4caf50", display: "inline-block", borderRadius: 2 }} />
              <span style={{ color: "var(--text3)" }}>Bullish</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 16, height: 3, background: "#f44336", display: "inline-block", borderRadius: 2 }} />
              <span style={{ color: "var(--text3)" }}>Bearish</span>
            </span>
          </div>
        </div>
      )}

      <style>{`
        .ta-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 18px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .ta-tabs::-webkit-scrollbar { display: none; }
        .ta-tab {
          padding: 6px 14px;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text3);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .ta-tab:hover { border-color: var(--primary2); color: var(--text); }
        .ta-tab--active {
          background: var(--primary2);
          border-color: var(--primary2);
          color: #fff;
        }
        .ta-toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
        }
        .ta-check {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          cursor: pointer;
          user-select: none;
        }
        .ta-check input {
          width: 13px;
          height: 13px;
          accent-color: var(--primary2);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

/* Fibonacci + Pivot sub-component */
function FibPivotTab({ priceData, fibonacci, pivotPoints }) {
  const fibLevels = useMemo(() => {
    if (!fibonacci) return [];
    const levels = [];
    const entries = Object.entries(fibonacci);
    entries.forEach(([key, val]) => {
      if (val != null && typeof val === "number") {
        levels.push({ label: key, value: val });
      }
    });
    return levels;
  }, [fibonacci]);

  const pivotLevels = useMemo(() => {
    if (!pivotPoints) return [];
    const levels = [];
    Object.entries(pivotPoints).forEach(([key, val]) => {
      if (val != null && typeof val === "number") {
        levels.push({ label: key.toUpperCase(), value: val });
      }
    });
    return levels;
  }, [pivotPoints]);

  const FIB_COLORS = {
    "0.0": "#9e9e9e",
    "0.236": "#2196f3",
    "0.382": "#00bcd4",
    "0.5": "#ff9800",
    "0.618": "#e91e63",
    "0.786": "#9c27b0",
    "1.0": "#9e9e9e",
  };

  const PIVOT_COLORS = {
    P: "var(--primary)",
    R1: "#f44336",
    R2: "#d32f2f",
    R3: "#b71c1c",
    S1: "#4caf50",
    S2: "#388e3c",
    S3: "#1b5e20",
  };

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: "0.8rem", fontWeight: 600, color: "var(--text3)" }}>
        Fibonacci Retracement & Pivot Points
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={priceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisPrice} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtPrice(v), n]} labelFormatter={fmtDate} />
          <Line type="monotone" dataKey="close" stroke="var(--primary)" strokeWidth={1.5} dot={false} name="Price" />
          {fibLevels.map((fl) => (
            <ReferenceLine
              key={`fib-${fl.label}`}
              y={fl.value}
              stroke={FIB_COLORS[fl.label] || "#ff9800"}
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{
                value: `Fib ${fl.label}`,
                position: "right",
                fill: "var(--text3)",
                fontSize: 9,
              }}
            />
          ))}
          {pivotLevels.map((pl) => (
            <ReferenceLine
              key={`pivot-${pl.label}`}
              y={pl.value}
              stroke={PIVOT_COLORS[pl.label] || "var(--text3)"}
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: pl.label,
                position: "left",
                fill: PIVOT_COLORS[pl.label] || "var(--text3)",
                fontSize: 9,
                fontWeight: 600,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Levels table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        {fibLevels.length > 0 && (
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase" }}>
              Fibonacci
            </div>
            {fibLevels.map((fl) => (
              <div
                key={fl.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  padding: "3px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ color: FIB_COLORS[fl.label] || "var(--text3)" }}>{fl.label}</span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{fmtPrice(fl.value)}</span>
              </div>
            ))}
          </div>
        )}
        {pivotLevels.length > 0 && (
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase" }}>
              Pivot Points
            </div>
            {pivotLevels.map((pl) => (
              <div
                key={pl.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  padding: "3px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ color: PIVOT_COLORS[pl.label] || "var(--text3)" }}>{pl.label}</span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{fmtPrice(pl.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

const VERDICT_COLORS = {
  "Strong Buy": "#22c55e",
  "Buy": "#4ade80",
  "Hold": "#eab308",
  "Sell": "#f87171",
  "Strong Sell": "#ef4444",
};

export default function EVScoreBadge({ score, verdict, size = "lg" }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const color = VERDICT_COLORS[verdict] || "#64748b";
  const radius = size === "lg" ? 54 : 36;
  const stroke = size === "lg" ? 6 : 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;
  const dim = (radius + stroke) * 2;

  useEffect(() => {
    let frame;
    let start = 0;
    const animate = () => {
      start += 2;
      if (start > score) start = score;
      setAnimatedScore(start);
      if (start < score) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="evs-badge" style={{ textAlign: "center" }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
        />
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
          fill="var(--text)" fontSize={size === "lg" ? 28 : 18} fontWeight="700">
          {animatedScore}
        </text>
        <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={size === "lg" ? 11 : 9} fontWeight="600" letterSpacing="0.5">
          {verdict?.toUpperCase()}
        </text>
      </svg>
      {size === "lg" && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          Equity Value Score
        </div>
      )}
    </div>
  );
}

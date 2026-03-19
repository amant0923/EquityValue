import "./ProfileResult.css";

const PROFILE_LABELS = {
  conservative: "Conservative",
  moderately_conservative: "Moderately Conservative",
  moderate: "Moderate",
  moderately_aggressive: "Moderately Aggressive",
  aggressive: "Aggressive",
};

const METHOD_LABELS = {
  conservative: "Global Minimum Variance",
  moderately_conservative: "GMV + EVS Tilt",
  moderate: "Black-Litterman + EVS",
  moderately_aggressive: "Black-Litterman + EVS",
  aggressive: "Black-Litterman + EVS",
};

export default function ProfileResult({ score, profile }) {
  const profileKey = profile || "moderate";
  const profileName = PROFILE_LABELS[profileKey] || "Moderate";
  const method = METHOD_LABELS[profileKey] || "Black-Litterman + EVS";

  return (
    <div className="profile-result">
      <div className="profile-result__score">{score ?? 0}</div>
      <div className="profile-result__name">{profileName}</div>
      <div className="profile-result__badges">
        <span className="profile-result__badge">{method}</span>
        <span className="profile-result__badge">Covariance: Ledoit-Wolf shrinkage</span>
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ onClose, initialMode = "login" }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState(initialMode); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [disclaimer, setDisclaimer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || !password) return setError("Please fill in all fields");
    if (mode === "signup" && password !== confirmPw) return setError("Passwords do not match");
    if (mode === "signup" && password.length < 6) return setError("Password must be at least 6 characters");
    if (mode === "signup" && !disclaimer) return setError("You must acknowledge the disclaimer to sign up");

    setLoading(true);
    try {
      if (mode === "login") {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
        onClose();
      } else {
        const { data, error: err } = await signUp(email, password);
        if (err) throw err;
        if (data?.user?.identities?.length === 0) {
          setError("An account with this email already exists");
        } else {
          setSuccess("Check your email to confirm your account, then log in.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="auth-modal"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <svg viewBox="0 0 16 16" fill="none">
              <polyline points="1,12 5,7 9,10 15,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="auth-logo-text">ValuEngine</span>
        </div>

        <h2 className="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Sign in to access your valuation tools"
            : "Start with 1 free analysis per day"}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "signup" && (
            <>
              <div className="auth-field">
                <label className="auth-label">Confirm Password</label>
                <input
                  className="auth-input"
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <label className="auth-disclaimer-check">
                <input
                  type="checkbox"
                  checked={disclaimer}
                  onChange={e => setDisclaimer(e.target.checked)}
                />
                <span className="auth-disclaimer-text">
                  I understand that ValuEngine is <strong>not a registered financial adviser</strong> and does not provide financial advice.
                  All valuations are for <strong>educational and research purposes only</strong>.
                  I will not make investment decisions based solely on this tool.
                </span>
              </label>
            </>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="auth-spinner" />
            ) : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <p>Don't have an account? <button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>Sign up</button></p>
          ) : (
            <p>Already have an account? <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Sign in</button></p>
          )}
        </div>
      </motion.div>

      <style>{`
        .auth-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .auth-modal {
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: var(--radius-xl);
          max-width: 420px; width: 100%;
          padding: 36px;
        }
        .auth-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
        .auth-logo-mark {
          width: 28px; height: 28px;
          background: linear-gradient(135deg, var(--primary), var(--indigo));
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
        }
        .auth-logo-mark svg { width: 15px; height: 15px; }
        .auth-logo-text { font-size: 1rem; font-weight: 700; }

        .auth-title { font-size: 1.2rem; font-weight: 700; color: var(--text); margin-bottom: 6px; letter-spacing: -0.3px; }
        .auth-subtitle { font-size: 0.82rem; color: var(--text2); margin-bottom: 24px; }

        .auth-error {
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.2);
          color: #fca5a5;
          padding: 10px 14px;
          border-radius: var(--radius);
          font-size: 0.8rem;
          margin-bottom: 16px;
        }
        .auth-success {
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          color: #6ee7b7;
          padding: 10px 14px;
          border-radius: var(--radius);
          font-size: 0.8rem;
          margin-bottom: 16px;
        }

        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-field { display: flex; flex-direction: column; gap: 6px; }
        .auth-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px;
          text-transform: uppercase; color: var(--text3);
        }
        .auth-input {
          background: var(--surface2);
          border: 1px solid var(--border2);
          color: var(--text);
          padding: 10px 14px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .auth-input:focus { border-color: var(--primary); }
        .auth-input::placeholder { color: var(--muted); }

        .auth-disclaimer-check {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          cursor: pointer;
          padding: 12px 14px;
          background: rgba(245,158,11,0.05);
          border: 1px solid rgba(245,158,11,0.15);
          border-radius: var(--radius);
        }
        .auth-disclaimer-check input[type="checkbox"] {
          margin-top: 2px;
          flex-shrink: 0;
          accent-color: var(--primary);
          width: 16px;
          height: 16px;
        }
        .auth-disclaimer-text {
          font-size: 0.75rem;
          color: var(--text2);
          line-height: 1.65;
        }
        .auth-disclaimer-text strong { color: var(--yellow2); }

        .auth-submit {
          width: 100%;
          background: linear-gradient(135deg, var(--primary), var(--indigo));
          color: #fff;
          border: none;
          padding: 12px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
        }
        .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-submit:hover:not(:disabled) { opacity: 0.9; }
        .auth-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .auth-switch {
          text-align: center;
          margin-top: 20px;
          font-size: 0.8rem;
          color: var(--text3);
        }
        .auth-switch button {
          background: none;
          border: none;
          color: var(--primary2);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          text-decoration: underline;
          text-decoration-color: transparent;
          transition: text-decoration-color 0.2s;
        }
        .auth-switch button:hover { text-decoration-color: var(--primary2); }

        @media (max-width: 480px) {
          .auth-modal { padding: 24px 20px; }
        }
      `}</style>
    </motion.div>
  );
}

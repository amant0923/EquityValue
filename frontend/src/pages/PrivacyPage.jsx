export default function PrivacyPage() {
  const sectionStyle = {
    marginBottom: 40,
  };

  const headingStyle = {
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 10,
    letterSpacing: "-0.3px",
  };

  const bodyStyle = {
    fontSize: "0.9rem",
    color: "var(--text2)",
    lineHeight: 1.75,
    margin: 0,
  };

  const listStyle = {
    fontSize: "0.9rem",
    color: "var(--text2)",
    lineHeight: 1.75,
    paddingLeft: 20,
    margin: "8px 0 0 0",
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 12,
    fontSize: "0.875rem",
  };

  const thStyle = {
    textAlign: "left",
    padding: "8px 12px",
    color: "var(--text2)",
    fontWeight: 600,
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
  };

  const tdStyle = {
    padding: "8px 12px",
    color: "var(--text2)",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "top",
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.8px", marginBottom: 8 }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 48 }}>
        Last updated: March 2026
      </p>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. Data We Collect</h2>
        <p style={bodyStyle}>We collect only what is necessary to provide the service:</p>
        <ul style={listStyle}>
          <li><strong style={{ color: "var(--text)" }}>Email address</strong> — used for authentication and communications</li>
          <li><strong style={{ color: "var(--text)" }}>Watchlist &amp; preferences</strong> — tickers you save, alert settings, and display preferences</li>
          <li><strong style={{ color: "var(--text)" }}>Usage analytics</strong> — pages visited, features used, and search queries (aggregated)</li>
          <li><strong style={{ color: "var(--text)" }}>No payment data</strong> — all billing is handled directly by Stripe; we never see or store your card details</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. How We Use Your Data</h2>
        <ul style={listStyle}>
          <li><strong style={{ color: "var(--text)" }}>Account management</strong> — authenticating you and maintaining your subscription</li>
          <li><strong style={{ color: "var(--text)" }}>Personalized experience</strong> — displaying your watchlist, alert preferences, and saved settings</li>
          <li><strong style={{ color: "var(--text)" }}>Product improvement</strong> — understanding which features are used to prioritize development</li>
          <li><strong style={{ color: "var(--text)" }}>Email communications</strong> — weekly digest emails, score alerts, and important account notices (you can unsubscribe)</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. Data Sharing</h2>
        <p style={bodyStyle}>
          We do not sell, rent, or share your personal data with third parties for marketing purposes.
          We use the following third-party services to operate the platform:
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Service</th>
              <th style={thStyle}>Purpose</th>
              <th style={thStyle}>Data Shared</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Supabase</td>
              <td style={tdStyle}>Database &amp; authentication</td>
              <td style={tdStyle}>Email, watchlist, preferences</td>
            </tr>
            <tr>
              <td style={tdStyle}>Stripe</td>
              <td style={tdStyle}>Payment processing</td>
              <td style={tdStyle}>Email, subscription tier</td>
            </tr>
            <tr>
              <td style={tdStyle}>Resend</td>
              <td style={tdStyle}>Transactional &amp; digest email</td>
              <td style={tdStyle}>Email address</td>
            </tr>
            <tr>
              <td style={tdStyle}>Vercel</td>
              <td style={tdStyle}>Frontend hosting</td>
              <td style={tdStyle}>Anonymized request logs</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. Cookies</h2>
        <p style={bodyStyle}>
          We use cookies solely for authentication session management and basic analytics (pages visited,
          session duration). We do not use advertising cookies or track you across other websites.
          You can disable cookies in your browser settings, though this may prevent login from working.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. Your Rights</h2>
        <ul style={listStyle}>
          <li><strong style={{ color: "var(--text)" }}>Access &amp; correction</strong> — you can view and update your account data at any time</li>
          <li><strong style={{ color: "var(--text)" }}>Deletion</strong> — you can delete your account and all associated data from your account settings</li>
          <li><strong style={{ color: "var(--text)" }}>Data export</strong> — contact us to request a copy of your personal data in a portable format</li>
          <li><strong style={{ color: "var(--text)" }}>Opt out of marketing</strong> — unsubscribe from any email using the link at the bottom of that email</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. CCPA / GDPR</h2>
        <p style={bodyStyle}>
          California residents have the right to know what personal information we collect, request deletion,
          and opt out of the sale of personal information (we do not sell personal information).
          EU and UK residents have rights under GDPR including the right of access, rectification, erasure,
          restriction of processing, and data portability. To exercise any of these rights, contact us at{" "}
          <a href="mailto:privacy@equityvalue.ai" style={{ color: "var(--primary)", textDecoration: "none" }}>
            privacy@equityvalue.ai
          </a>
          . We will respond within 30 days.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. Data Retention</h2>
        <p style={bodyStyle}>
          Your account data is retained while your account is active. If you delete your account, your
          personal data (email, watchlist, alert settings) will be permanently deleted within 30 days.
          Anonymized usage analytics may be retained indefinitely as they cannot be linked back to you.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. Security</h2>
        <p style={bodyStyle}>
          All data is encrypted in transit using HTTPS/TLS. Authentication is handled by Supabase Auth,
          which uses industry-standard bcrypt password hashing and JWT session tokens. We do not store
          passwords in plaintext. While we take reasonable precautions, no system is completely secure —
          please use a strong, unique password for your account.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>9. Contact</h2>
        <p style={bodyStyle}>
          For privacy-related questions or requests, contact us at{" "}
          <a href="mailto:privacy@equityvalue.ai" style={{ color: "var(--primary)", textDecoration: "none" }}>
            privacy@equityvalue.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function TermsPage() {
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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.8px", marginBottom: 8 }}>
        Terms of Service
      </h1>
      <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 48 }}>
        Last updated: March 2026
      </p>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. Service Description</h2>
        <p style={bodyStyle}>
          Equity Value is a stock valuation and analysis platform providing automated fundamental analysis
          for informational and educational purposes. Our platform uses quantitative valuation models to
          estimate the intrinsic value of publicly traded securities based on publicly available financial data.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. Not Investment Advice</h2>
        <p style={bodyStyle}>
          Equity Value is not a registered investment advisor, broker-dealer, or financial planner. All
          information provided is for educational and informational purposes only and should not be construed
          as investment advice, a recommendation, or a solicitation. Nothing on this platform constitutes a
          recommendation to buy, sell, or hold any security. Always consult a licensed financial advisor
          before making any investment decisions.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. No Guarantee of Accuracy</h2>
        <p style={bodyStyle}>
          While we strive for accuracy, we make no warranties regarding the completeness, reliability, or
          accuracy of any information. Valuation models are mathematical estimates based on historical data
          and may not reflect future performance. The Equity Value Score (EVS) and all other metrics are
          proprietary estimates and should not be relied upon as definitive assessments of any company's
          financial condition or investment merit.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. Data Sources</h2>
        <p style={bodyStyle}>
          Financial data is sourced from third-party providers including Financial Modeling Prep, Finnhub,
          and Yahoo Finance. We do not guarantee the accuracy of third-party data. Data may be delayed,
          incomplete, or contain errors. We are not responsible for any losses arising from reliance on
          third-party data provided through this platform.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. Subscription Terms</h2>
        <p style={bodyStyle}>
          Paid plans are billed on a monthly or annual basis through Stripe. By subscribing, you authorize
          us to charge your payment method on a recurring basis. You may cancel your subscription at any
          time through your account settings; cancellation takes effect at the end of the current billing
          period. We do not offer refunds for partial billing periods. Annual subscriptions may be eligible
          for a prorated refund within 14 days of purchase — contact support to request one.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. Acceptable Use</h2>
        <p style={bodyStyle}>
          You agree not to:
        </p>
        <ul style={listStyle}>
          <li>Scrape, crawl, or systematically extract data from the platform without written permission</li>
          <li>Redistribute, resell, or sublicense any data or content obtained from this platform</li>
          <li>Use platform outputs to power automated trading systems or algorithmic strategies without a commercial license</li>
          <li>Attempt to reverse-engineer, decompile, or circumvent any security or access controls</li>
          <li>Use the platform in any way that violates applicable laws or regulations</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. Limitation of Liability</h2>
        <p style={bodyStyle}>
          To the maximum extent permitted by law, Equity Value and its operators shall not be liable for
          any indirect, incidental, special, consequential, or punitive damages, including but not limited
          to loss of profits, data, or investment losses, arising from your use of or inability to use
          this platform. Our total liability for any claim arising from these terms shall not exceed the
          amount you paid us in the 12 months preceding the claim.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. Changes to Terms</h2>
        <p style={bodyStyle}>
          We may update these terms from time to time. When we do, we will update the "last updated" date
          at the top of this page. Continued use of the platform after changes are posted constitutes your
          acceptance of the revised terms. We will notify subscribers of material changes via email.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>9. Contact</h2>
        <p style={bodyStyle}>
          For questions about these Terms of Service, please contact us at{" "}
          <a href="mailto:support@equityvalue.ai" style={{ color: "var(--primary)", textDecoration: "none" }}>
            support@equityvalue.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}

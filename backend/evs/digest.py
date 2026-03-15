"""Weekly digest email — sends personalized summaries to users via Resend."""
import os
import sys
import requests
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "digest@equityvalue.ai"
APP_URL = "https://equityvalue.ai"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_top_scores(n=5):
    return sb.table("equity_value_scores") \
        .select("ticker, score, verdict") \
        .order("score", desc=True) \
        .limit(n) \
        .execute().data


def get_biggest_movers(n=5):
    """Get stocks with largest score changes this week."""
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    current = {r["ticker"]: r["score"] for r in
               sb.table("equity_value_scores").select("ticker, score").execute().data}
    prev = {r["ticker"]: r["score"] for r in
            sb.table("equity_value_score_history").select("ticker, score")
            .gte("computed_at", week_ago).execute().data}
    movers = []
    for ticker, cur_score in current.items():
        prev_score = prev.get(ticker)
        if prev_score is not None:
            change = cur_score - prev_score
            movers.append({"ticker": ticker, "score": cur_score, "change": change})
    movers.sort(key=lambda x: abs(x["change"]), reverse=True)
    return movers[:n]


def build_html(top_scores, movers, is_pro=True):
    """Build digest HTML email. Free users get limited version."""
    display_top = top_scores if is_pro else top_scores[:3]
    top_rows = "".join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{s["ticker"]}" style="color:#2563eb;font-weight:600">{s["ticker"]}</a></td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:700">{s["score"]}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee">{s["verdict"]}</td></tr>'
        for s in display_top
    )

    movers_section = ""
    if is_pro and movers:
        mover_rows = "".join(
            f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{m["ticker"]}" style="color:#2563eb;font-weight:600">{m["ticker"]}</a></td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{m["score"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:{"#22c55e" if m["change"] > 0 else "#ef4444"}">'
            f'{"+" if m["change"] > 0 else ""}{m["change"]}</td></tr>'
            for m in movers
        )
        movers_section = f"""
        <h2 style="font-size:16px;margin:24px 0 12px">Biggest Score Movers</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">Score</th><th style="padding:8px">Change</th></tr>
          {mover_rows}
        </table>
        """

    upgrade_cta = "" if is_pro else """
        <div style="margin:20px 0;padding:16px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;text-align:center">
          <p style="margin:0 0 8px;font-size:14px;color:#1e40af;font-weight:600">Upgrade to Pro for the full digest</p>
          <p style="margin:0 0 12px;font-size:12px;color:#64748b">See all top scores, biggest movers, and score alerts</p>
          <a href="{APP_URL}/dashboard" style="display:inline-block;padding:8px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px">Upgrade Now</a>
        </div>
    """.replace("{APP_URL}", APP_URL)

    return f"""
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#1e293b">
      <div style="padding:24px;background:#2563eb;color:white;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Equity Value Weekly Digest</h1>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px">{datetime.now().strftime("%B %d, %Y")}</p>
      </div>
      <div style="padding:24px;background:white;border:1px solid #e2e8f0;border-top:none">
        <h2 style="font-size:16px;margin:0 0 12px">Top Scoring Stocks</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">EVS</th><th style="padding:8px;text-align:left">Verdict</th></tr>
          {top_rows}
        </table>
        {movers_section}
        {upgrade_cta}
        <div style="margin-top:24px;text-align:center">
          <a href="{APP_URL}/dashboard" style="display:inline-block;padding:10px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">View Dashboard</a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#94a3b8">
        Equity Value is an educational tool, not investment advice.<br/>
        <a href="{APP_URL}/unsubscribe" style="color:#94a3b8">Unsubscribe</a>
      </div>
    </div>
    """


def send_digest():
    if not RESEND_API_KEY:
        print("RESEND_API_KEY not set, skipping digest")
        return
    top = get_top_scores()
    movers = get_biggest_movers()
    pro_html = build_html(top, movers, is_pro=True)
    free_html = build_html(top, movers, is_pro=False)

    # Get all users with profiles
    users = sb.table("user_profiles").select("id, plan").execute().data
    sent = 0
    for user in users:
        try:
            auth_user = sb.auth.admin.get_user_by_id(user["id"])
            email = auth_user.user.email if auth_user and auth_user.user else None
            if not email:
                continue
            is_pro = user.get("plan", "free") in ("pro", "max")
            html = pro_html if is_pro else free_html
            requests.post("https://api.resend.com/emails", json={
                "from": FROM_EMAIL,
                "to": email,
                "subject": f"Weekly Digest: Top EVS Scores | {datetime.now().strftime('%b %d')}",
                "html": html,
            }, headers={"Authorization": f"Bearer {RESEND_API_KEY}"})
            sent += 1
        except Exception as e:
            print(f"  EMAIL ERROR {user['id']}: {e}")
    print(f"Sent {sent} digest emails")


if __name__ == "__main__":
    send_digest()

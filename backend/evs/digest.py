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


def build_html(top_scores, movers):
    """Build digest HTML email."""
    top_rows = "".join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{s["ticker"]}" style="color:#2563eb;font-weight:600">{s["ticker"]}</a></td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:700">{s["score"]}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee">{s["verdict"]}</td></tr>'
        for s in top_scores
    )
    mover_rows = "".join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{m["ticker"]}" style="color:#2563eb;font-weight:600">{m["ticker"]}</a></td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{m["score"]}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:{"#22c55e" if m["change"] > 0 else "#ef4444"}">'
        f'{"+" if m["change"] > 0 else ""}{m["change"]}</td></tr>'
        for m in movers
    )
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
        <h2 style="font-size:16px;margin:24px 0 12px">Biggest Score Movers</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">Score</th><th style="padding:8px">Change</th></tr>
          {mover_rows}
        </table>
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
    html = build_html(top, movers)

    # Get all users with profiles
    users = sb.table("user_profiles").select("id").execute().data
    sent = 0
    for user in users:
        try:
            auth_user = sb.auth.admin.get_user_by_id(user["id"])
            email = auth_user.user.email if auth_user and auth_user.user else None
            if not email:
                continue
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

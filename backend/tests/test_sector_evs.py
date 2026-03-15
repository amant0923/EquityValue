from evs.sector import compute_sector_percentiles, get_peer_context

def test_compute_sector_percentiles():
    scores = [
        {"ticker": "AAPL", "score": 80, "sector": "Technology"},
        {"ticker": "MSFT", "score": 70, "sector": "Technology"},
        {"ticker": "GOOG", "score": 60, "sector": "Technology"},
        {"ticker": "JPM", "score": 75, "sector": "Financials"},
        {"ticker": "BAC", "score": 55, "sector": "Financials"},
    ]
    result = compute_sector_percentiles(scores)

    aapl = next(r for r in result if r["ticker"] == "AAPL")
    assert aapl["sector_rank"] == 1
    assert aapl["sector_total"] == 3
    assert aapl["sector_percentile"] == 100.0  # Top of sector

    goog = next(r for r in result if r["ticker"] == "GOOG")
    assert goog["sector_rank"] == 3
    assert goog["sector_total"] == 3

def test_compute_sector_percentiles_single_stock():
    scores = [{"ticker": "ONLY", "score": 50, "sector": "Utilities"}]
    result = compute_sector_percentiles(scores)
    assert result[0]["sector_rank"] == 1
    assert result[0]["sector_percentile"] == 100.0

def test_get_peer_context():
    scores = [
        {"ticker": "AAPL", "score": 80, "sector": "Technology", "industry": "Consumer Electronics"},
        {"ticker": "MSFT", "score": 70, "sector": "Technology", "industry": "Software"},
        {"ticker": "GOOG", "score": 60, "sector": "Technology", "industry": "Internet"},
        {"ticker": "META", "score": 65, "sector": "Technology", "industry": "Internet"},
    ]
    ctx = get_peer_context("GOOG", scores)
    assert ctx["peer_rank"] == 2  # Among Internet peers (META=65, GOOG=60)
    assert ctx["peer_avg_score"] == 62.5
    assert "META" in [p["ticker"] for p in ctx["peer_group"]]

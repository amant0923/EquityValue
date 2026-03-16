"""Abstract base class for financial data providers."""
from abc import ABC, abstractmethod


class DataProvider(ABC):
    """Interface that all data providers must implement."""

    @abstractmethod
    def get_fundamentals(self, ticker: str) -> dict:
        """Fetch company fundamentals (profile, ratios, key stats).

        Returns a dict with fields like: name, sector, industry, market_cap,
        current_price, pe_ratio, pb_ratio, roe, revenue, ebitda, etc.
        """
        ...

    @abstractmethod
    def get_financial_statements(self, ticker: str, period: str = "annual") -> list:
        """Fetch income, balance sheet, and cash flow statements.

        Args:
            ticker: Stock ticker symbol.
            period: "annual" or "quarterly".

        Returns a list of statement dicts with statement_type, period_date, etc.
        """
        ...

    @abstractmethod
    def get_key_metrics(self, ticker: str) -> list:
        """Fetch key valuation and efficiency metrics over time.

        Returns a list of metric dicts ordered by period_date descending.
        """
        ...

    @abstractmethod
    def get_analyst_data(self, ticker: str) -> dict:
        """Fetch analyst ratings, price targets, and recent grade changes.

        Returns a dict with ratings, price_targets, recent_grades fields.
        """
        ...

    @abstractmethod
    def get_insider_trades(self, ticker: str) -> list:
        """Fetch recent insider transactions.

        Returns a list of trade dicts with filing_date, reporter_name,
        shares_traded, price, etc.
        """
        ...

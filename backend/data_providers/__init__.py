"""Data provider abstraction layer — swap FMP for Alpha Vantage etc."""
from data_providers.base import DataProvider
from data_providers.factory import get_provider

__all__ = ["DataProvider", "get_provider"]

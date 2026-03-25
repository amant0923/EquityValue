"""Tests for ticker validation."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest
from config import validate_ticker
from fastapi import HTTPException


def test_valid_ticker():
    assert validate_ticker("AAPL") == "AAPL"


def test_lowercase_normalized():
    assert validate_ticker("aapl") == "AAPL"


def test_ticker_with_dot():
    assert validate_ticker("BRK.B") == "BRK.B"


def test_whitespace_stripped():
    assert validate_ticker("  MSFT  ") == "MSFT"


def test_invalid_ticker_special_chars():
    with pytest.raises(HTTPException) as exc_info:
        validate_ticker("AA$BB")
    assert exc_info.value.status_code == 400


def test_invalid_ticker_too_long():
    with pytest.raises(HTTPException) as exc_info:
        validate_ticker("ABCDEFGH")
    assert exc_info.value.status_code == 400


def test_empty_ticker():
    with pytest.raises(HTTPException) as exc_info:
        validate_ticker("")
    assert exc_info.value.status_code == 400


def test_sql_injection_attempt():
    with pytest.raises(HTTPException) as exc_info:
        validate_ticker("'; DROP TABLE--")
    assert exc_info.value.status_code == 400

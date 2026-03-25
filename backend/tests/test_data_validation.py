"""Tests for data validation helpers."""
import sys
import os
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data_fetcher import _safe_val


def test_safe_val_with_valid_number():
    assert _safe_val(42.5) == 42.5


def test_safe_val_with_none():
    assert _safe_val(None) is None


def test_safe_val_with_default():
    assert _safe_val(None, default=0) == 0


def test_safe_val_with_string_number():
    assert _safe_val("42.5") == 42.5


def test_safe_val_with_nan_string():
    assert _safe_val("nan") is None


def test_safe_val_with_na_string():
    assert _safe_val("N/A") is None


def test_safe_val_with_empty_string():
    assert _safe_val("") is None


def test_safe_val_with_dash():
    assert _safe_val("-") is None


def test_safe_val_with_none_string():
    assert _safe_val("None") is None


def test_safe_val_with_float_nan():
    assert _safe_val(float("nan")) is None


def test_safe_val_with_float_inf():
    assert _safe_val(float("inf")) is None


def test_safe_val_with_negative_inf():
    assert _safe_val(float("-inf")) is None


def test_safe_val_with_zero():
    assert _safe_val(0) == 0.0


def test_safe_val_with_negative():
    assert _safe_val(-15.5) == -15.5


def test_safe_val_with_non_numeric_string():
    assert _safe_val("hello") is None

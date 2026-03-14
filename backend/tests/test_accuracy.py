"""Unit tests for accuracy direction calculation."""


def test_direction_correct_when_undervalued_and_rises():
    iv, price_at, price_now = 200, 150, 180
    predicted = "up" if iv > price_at else "down"
    actual = "up" if price_now > price_at else "down"
    assert predicted == actual == "up"


def test_direction_correct_when_overvalued_and_falls():
    iv, price_at, price_now = 100, 150, 120
    predicted = "up" if iv > price_at else "down"
    actual = "up" if price_now > price_at else "down"
    assert predicted == actual == "down"


def test_direction_wrong_when_undervalued_but_falls():
    iv, price_at, price_now = 200, 150, 130
    predicted = "up" if iv > price_at else "down"
    actual = "up" if price_now > price_at else "down"
    assert predicted != actual

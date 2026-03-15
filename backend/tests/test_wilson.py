from utils.wilson import wilson_confidence_interval

def test_wilson_basic():
    low, high = wilson_confidence_interval(0.72, 100)
    assert 0.62 < low < 0.66
    assert 0.77 < high < 0.81

def test_wilson_small_sample():
    low, high = wilson_confidence_interval(0.80, 5)
    # Wide interval for small sample
    assert high - low > 0.3

def test_wilson_perfect_accuracy():
    low, high = wilson_confidence_interval(1.0, 50)
    assert high == 1.0
    assert low > 0.90

def test_wilson_zero_accuracy():
    low, high = wilson_confidence_interval(0.0, 50)
    assert low == 0.0
    assert high < 0.10

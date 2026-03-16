"""Factory for creating data provider instances."""
from data_providers.base import DataProvider


def get_provider(name: str = "fmp", **kwargs) -> DataProvider:
    """Return a DataProvider instance by name.

    Args:
        name: Provider identifier. Currently supported: "fmp".
        **kwargs: Passed to the provider constructor (e.g. api_key).

    Returns:
        A DataProvider implementation.

    Raises:
        ValueError: If the provider name is not recognized.
    """
    if name == "fmp":
        from data_providers.fmp import FMPProvider
        return FMPProvider(**kwargs)
    else:
        raise ValueError(
            f"Unknown data provider: '{name}'. Supported: fmp"
        )

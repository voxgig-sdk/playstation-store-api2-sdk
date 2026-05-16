# PlaystationStoreApi2 SDK feature factory

from feature.base_feature import PlaystationStoreApi2BaseFeature
from feature.test_feature import PlaystationStoreApi2TestFeature


def _make_feature(name):
    features = {
        "base": lambda: PlaystationStoreApi2BaseFeature(),
        "test": lambda: PlaystationStoreApi2TestFeature(),
    }
    factory = features.get(name)
    if factory is not None:
        return factory()
    return features["base"]()

# PlaystationStoreApi2 SDK feature factory

from playstationstoreapi2_sdk.feature.base_feature import PlaystationStoreApi2BaseFeature
from playstationstoreapi2_sdk.feature.ratelimit_feature import PlaystationStoreApi2RatelimitFeature
from playstationstoreapi2_sdk.feature.retry_feature import PlaystationStoreApi2RetryFeature
from playstationstoreapi2_sdk.feature.test_feature import PlaystationStoreApi2TestFeature
from playstationstoreapi2_sdk.feature.timeout_feature import PlaystationStoreApi2TimeoutFeature


_FEATURES = {
    "base": lambda: PlaystationStoreApi2BaseFeature(),
    "ratelimit": lambda: PlaystationStoreApi2RatelimitFeature(),
    "retry": lambda: PlaystationStoreApi2RetryFeature(),
    "test": lambda: PlaystationStoreApi2TestFeature(),
    "timeout": lambda: PlaystationStoreApi2TimeoutFeature(),
}


def _make_feature(name):
    factory = _FEATURES.get(name)
    if factory is not None:
        return factory()
    return _FEATURES["base"]()


# True when this SDK was generated with the named feature class - the
# constructor's tolerance for extend-carried features reads this (an
# active name with no generated class must not become a BaseFeature
# stray when an extend instance carries it).
def _has_feature(name):
    return name in _FEATURES

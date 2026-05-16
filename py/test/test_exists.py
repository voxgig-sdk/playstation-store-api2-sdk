# ProjectName SDK exists test

import pytest
from playstationstoreapi2_sdk import PlaystationStoreApi2SDK


class TestExists:

    def test_should_create_test_sdk(self):
        testsdk = PlaystationStoreApi2SDK.test(None, None)
        assert testsdk is not None

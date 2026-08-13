# PlaystationStoreApi2 SDK error

from __future__ import annotations


class PlaystationStoreApi2Error(Exception):
    def __init__(self, code="", msg="", ctx=None):
        super().__init__(msg)
        self.is_sdk_error = True
        self.sdk = "PlaystationStoreApi2"
        self.code = code
        self.msg = msg
        self.ctx = ctx
        self.result = None
        self.spec = None

    def __str__(self):
        return self.msg

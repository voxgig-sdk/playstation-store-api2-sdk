# PlaystationStoreApi2 SDK utility: make_context

from core.context import PlaystationStoreApi2Context


def make_context_util(ctxmap, basectx):
    return PlaystationStoreApi2Context(ctxmap, basectx)

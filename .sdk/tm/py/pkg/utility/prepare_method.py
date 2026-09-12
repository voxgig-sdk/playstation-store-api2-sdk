# PlaystationStoreApi2 SDK utility: prepare_method

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs

METHOD_MAP = {
    "create": "POST",
    "update": "PUT",
    "load": "GET",
    "list": "GET",
    "remove": "DELETE",
    "patch": "PATCH",
}


def prepare_method_util(ctx):
    opname = ctx.op.name

    # The API definition is authoritative: a POST-only or PATCH-based API
    # exposes `update` as POST or PATCH, not the PUT the op name implies.
    # Only fall back to the op-name convention when the point has no method.
    method = vs.getprop(ctx.point, "method")
    if isinstance(method, str) and "" != method:
        return method.upper()

    # No default: an op name outside the convention resolves to no method,
    # exactly as the ts reference (`methodMap[key]` is undefined there).
    # The silent-pass inline runner hid a stray "GET" fallback here; the
    # shared corpus (prepareMethod, opname "bad" -> null) pins it now.
    return METHOD_MAP.get(opname)

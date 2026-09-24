# PlaystationStoreApi2 SDK utility: transform_request

from __future__ import annotations
from playstationstoreapi2_sdk.utility.voxgig_struct import voxgig_struct as vs
from playstationstoreapi2_sdk.core.helpers import to_map


# `$action` selects the point (see make_point_util); it is never an API field,
# so the body is a copy without it. The caller's dict is left untouched.
def _strip_action(reqdata):
    if not isinstance(reqdata, dict) or "$action" not in reqdata:
        return reqdata
    return {k: v for k, v in reqdata.items() if k != "$action"}


def transform_request_util(ctx):
    spec = ctx.spec
    point = ctx.point

    if spec is not None:
        spec.step = "reqform"

    transform = to_map(vs.getprop(point, "transform"))
    if transform is None:
        return _strip_action(ctx.reqdata)

    reqform = vs.getprop(transform, "req")
    if reqform is None:
        return _strip_action(ctx.reqdata)

    reqdata = vs.transform({
        "reqdata": ctx.reqdata,
    }, reqform)

    return _strip_action(reqdata)

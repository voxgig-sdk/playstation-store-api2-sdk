# PlaystationStoreApi2 SDK Container entity

from __future__ import annotations

from utility.voxgig_struct import voxgig_struct as vs
from core import helpers
from playstationstoreapi2_types import (
    Container,
    ContainerListMatch,
)


class ContainerEntity:

    def __init__(self, client, entopts=None):
        if entopts is None:
            entopts = {}
        if "active" not in entopts:
            entopts["active"] = True
        elif entopts["active"] is False:
            pass  # keep false
        else:
            entopts["active"] = True

        self._name = "container"
        self._client = client
        self._utility = client.get_utility()
        self._entopts = entopts
        self._data = {}
        self._match = {}

        self._entctx = self._utility.make_context({
            "entity": self,
            "entopts": entopts,
        }, client.get_root_ctx())

        self._utility.feature_hook(self._entctx, "PostConstructEntity")

    def get_name(self):
        return self._name

    def make(self):
        opts = {}
        for k, v in self._entopts.items():
            opts[k] = v
        return ContainerEntity(self._client, opts)

    def data_set(self, args=None):
        if args is not None:
            self._data = helpers.to_map(vs.clone(args)) or {}
            self._utility.feature_hook(self._entctx, "SetData")

    def data_get(self) -> Container:
        self._utility.feature_hook(self._entctx, "GetData")
        return vs.clone(self._data)

    def match_set(self, args=None):
        if args is not None:
            self._match = helpers.to_map(vs.clone(args)) or {}
            self._utility.feature_hook(self._entctx, "SetMatch")

    def match_get(self) -> Container:
        self._utility.feature_hook(self._entctx, "GetMatch")
        return vs.clone(self._match)

    

    
    def list(self, reqmatch=None, ctrl=None) -> list[Container]:
        utility = self._utility
        # reqmatch is optional: an omitted match lists all records. Treat None
        # as an empty match so client.Container().list() works with no args.
        if reqmatch is None:
            reqmatch = {}
        ctx = utility.make_context({
            "opname": "list",
            "ctrl": ctrl,
            "match": self._match,
            "data": self._data,
            "reqmatch": reqmatch,
        }, self._entctx)

        def post_done():
            if ctx.result is not None:
                if ctx.result.resmatch is not None:
                    self._match = ctx.result.resmatch

        return self._run_op(ctx, post_done)



    

    

    

    def _run_op(self, ctx, post_done):
        utility = self._utility

        # #PrePoint-Hook

        point, err = utility.make_point(ctx)
        ctx.out["point"] = point
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreSpec-Hook

        spec, err = utility.make_spec(ctx)
        ctx.out["spec"] = spec
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreRequest-Hook

        resp, err = utility.make_request(ctx)
        ctx.out["request"] = resp
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreResponse-Hook

        resp2, err = utility.make_response(ctx)
        ctx.out["response"] = resp2
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreResult-Hook

        result, err = utility.make_result(ctx)
        ctx.out["result"] = result
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreDone-Hook

        post_done()

        return utility.done(ctx)

# PlaystationStoreApi2 SDK primary utility test
#
# Corpus sections run through the vendored omni runner, via the resolver
# in test/omni.py (struct-runner shape over native voxgig_omni). The
# inline corpus engine this file used to carry is retired: omni resolves
# arguments, applies the null rules, and enforces out/err/match - the
# subjects below only adapt each utility's calling convention.
#
# Two conventions to know when adding a section:
#
# - Utilities that answer as a (value, err) TUPLE go through _unwrap,
#   which raises the err so omni can match it against `err:` expectations.
#   Utilities that answer bare values (or raise) are passed straight in.
#
# - `match: {ctx: ...}` assertions read the LIVE context after the
#   subject ran - the resolver's CtxView takes care of presenting the
#   context object as the map omni walks, camelCase keys included.

import pytest

from playstationstoreapi2_sdk import PlaystationStoreApi2SDK
from playstationstoreapi2_sdk.core.spec import PlaystationStoreApi2Spec
from playstationstoreapi2_sdk.core.result import PlaystationStoreApi2Result
from playstationstoreapi2_sdk.core.operation import PlaystationStoreApi2Operation
from playstationstoreapi2_sdk.core.error import PlaystationStoreApi2Error
from playstationstoreapi2_sdk.feature.base_feature import PlaystationStoreApi2BaseFeature

from test.omni import makeRunner


# Resolved against test/omni.py's own directory, so the suite works from
# any working directory.
TEST_JSON_FILE = '../../.sdk/test/test.json'


_runner = makeRunner(TEST_JSON_FILE, PlaystationStoreApi2SDK.test(None, None))
_run = _runner('primary')

spec = _run['spec']
runset = _run['runset']
runsetflags = _run['runsetflags']

# Under the old inline runner the suite drove the SDK directly; under omni
# the runpack's client is the provider wrapping it. This suite treats the
# client as the SDK - so unwrap the real instance (mirrors ts).
client = _run['client']['sdk']
utility = client._utility


# Sections deliberately left empty in the shared corpus
# (.sdk/test/primary/<name>.aon carries a PENDING header). Everything else
# MUST contribute cases.
PENDING = {
    'fetcher', 'makeFetchDef', 'makeResult',
    'featureAdd', 'featureHook', 'featureInit',
}


def runsection(name, subject):
    """Run one corpus section, failing loudly when it would run ZERO
    cases. A renamed section or a fixture that compiled to an empty `set`
    used to pass silently, which defeats the point of a shared oracle.
    EVERY corpus-backed test goes through here (mirrors ts)."""
    section = spec.get(name) if isinstance(spec, dict) else None
    assert section is not None, (
        "test corpus section '%s' missing - check the name against "
        ".sdk/test/primary/" % name)
    basic = section.get('basic') if isinstance(section, dict) else None
    assert isinstance(basic, dict) and isinstance(basic.get('set'), list), (
        "test corpus section '%s' has no basic.set list" % name)
    if 0 == len(basic['set']) and name not in PENDING:
        raise AssertionError(
            "test corpus section '%s' is EMPTY - zero cases would run; "
            "add cases, or mark the fixture PENDING in .sdk/test/primary/"
            % name)
    return runset(basic, subject)


def _unwrap(pair):
    """(value, err) tuple convention -> value-or-raise, omni's shape."""
    val, err = pair
    if err is not None:
        raise err
    return val


def _err_from_map(m):
    if m is None:
        return None
    msg = m.get("message", "")
    if msg == "":
        return None
    code = m.get("code", "")
    return PlaystationStoreApi2Error(code, msg)


def _make_test_ctx(client, utility, overrides=None):
    ctxmap = {
        "opname": "load",
        "client": client,
        "utility": utility,
    }
    if overrides is not None:
        for k, v in overrides.items():
            ctxmap[k] = v
    return utility.make_context(ctxmap, client.get_root_ctx())


def _make_test_full_ctx(client, utility):
    ctx = _make_test_ctx(client, utility)
    ctx.point = {
        "parts": ["items", "{id}"],
        "args": {"params": [{"name": "id", "reqd": True}]},
        "params": ["id"],
        "alias": {},
        "select": {},
        "active": True,
        "transform": {},
    }
    ctx.match = {"id": "item01"}
    ctx.reqmatch = {"id": "item01"}
    return ctx


class TestPrimaryUtility:

    def test_exists(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility

        assert utility.clean is not None
        assert utility.done is not None
        assert utility.make_error is not None
        assert utility.feature_add is not None
        assert utility.feature_hook is not None
        assert utility.feature_init is not None
        assert utility.fetcher is not None
        assert utility.make_fetch_def is not None
        assert utility.make_context is not None
        assert utility.make_options is not None
        assert utility.make_request is not None
        assert utility.make_response is not None
        assert utility.make_result is not None
        assert utility.make_point is not None
        assert utility.make_spec is not None
        assert utility.make_url is not None
        assert utility.param is not None
        assert utility.prepare_auth is not None
        assert utility.prepare_body is not None
        assert utility.prepare_headers is not None
        assert utility.prepare_method is not None
        assert utility.prepare_params is not None
        assert utility.prepare_path is not None
        assert utility.prepare_query is not None
        assert utility.result_basic is not None
        assert utility.result_body is not None
        assert utility.result_headers is not None
        assert utility.transform_request is not None
        assert utility.transform_response is not None

    def test_clean_basic(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_ctx(client, utility)
        val = {"key": "secret123", "name": "test"}
        cleaned = utility.clean(ctx, val)
        assert cleaned is not None

    def test_done_basic(self):
        runsection('done', lambda ctx: utility.done(ctx))

    def test_make_error_basic(self):
        def subject(ctx, errmap=None):
            err = _err_from_map(errmap) if isinstance(errmap, dict) else None
            # make_error() raises the constructed exception on the default
            # (throw) path; omni matches it against the entry's err.
            return utility.make_error(ctx, err)

        runsection('makeError', subject)

    def test_make_error_no_throw(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.ctrl.throw_err = False
        ctx.result = PlaystationStoreApi2Result({
            "ok": False,
            "resdata": {"id": "safe01"},
        })

        # throw_err is False: make_error returns the bare result data instead
        # of raising (the result-object / no-throw escape hatch).
        out = utility.make_error(ctx, ctx.make_error("test_code", "test message"))
        assert isinstance(out, dict)
        assert out["id"] == "safe01"

    def test_feature_add_basic(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_ctx(client, utility)
        start_len = len(client.features)

        feature = PlaystationStoreApi2BaseFeature()
        utility.feature_add(ctx, feature)

        assert len(client.features) == start_len + 1

    def test_feature_hook_basic(self):
        hook_client = PlaystationStoreApi2SDK.test(None, None)
        hook_utility = hook_client._utility
        ctx = _make_test_ctx(hook_client, hook_utility)

        state = {"called": False}

        class TestHookFeature(PlaystationStoreApi2BaseFeature):
            def TestHook(self, ctx):
                state["called"] = True

        hook_feature = TestHookFeature()
        hook_client.features = [hook_feature]

        hook_utility.feature_hook(ctx, "TestHook")
        assert state["called"] is True

    def test_feature_init_basic(self):
        init_client = PlaystationStoreApi2SDK.test(None, None)
        init_utility = init_client._utility
        ctx = _make_test_ctx(init_client, init_utility)
        ctx.options["feature"] = {
            "initfeat": {"active": True},
        }

        state = {"called": False}

        class TestInitFeature(PlaystationStoreApi2BaseFeature):
            def __init__(self):
                super().__init__()
                self.name = "initfeat"
                self.active = True

            def init(self, ctx, options):
                state["called"] = True

        feature = TestInitFeature()
        init_utility.feature_init(ctx, feature)
        assert state["called"] is True

    def test_feature_init_inactive(self):
        init_client = PlaystationStoreApi2SDK.test(None, None)
        init_utility = init_client._utility
        ctx = _make_test_ctx(init_client, init_utility)
        ctx.options["feature"] = {
            "nofeat": {"active": False},
        }

        state = {"called": False}

        class TestInitFeatureInactive(PlaystationStoreApi2BaseFeature):
            def __init__(self):
                super().__init__()
                self.name = "nofeat"
                self.active = False

            def init(self, ctx, options):
                state["called"] = True

        feature = TestInitFeatureInactive()
        init_utility.feature_init(ctx, feature)
        assert state["called"] is False

    def test_fetcher_live(self):
        calls = []

        def mock_fetch(url, fetchdef):
            calls.append({"url": url, "init": fetchdef})
            return {"status": 200, "statusText": "OK"}, None

        live_client = PlaystationStoreApi2SDK({
            # Concrete base: a live construction must satisfy any server
            # variables a templated base URL declares; a literal base
            # sidesteps the requirement.
            "base": "http://localhost:8080",
            "system": {
                "fetch": mock_fetch,
            },
        })
        live_utility = live_client._utility
        ctx = live_utility.make_context({
            "opname": "load",
            "client": live_client,
            "utility": live_utility,
        }, None)

        fetchdef = {"method": "GET", "headers": {}}
        _, err = live_utility.fetcher(ctx, "http://example.com/test", fetchdef)
        assert err is None
        assert len(calls) == 1
        assert calls[0]["url"] == "http://example.com/test"

    def test_fetcher_blocked_test_mode(self):
        def mock_fetch(url, fetchdef):
            return {}, None

        blocked_client = PlaystationStoreApi2SDK({
            "base": "http://localhost:8080",
            "system": {
                "fetch": mock_fetch,
            },
        })
        blocked_client.mode = "test"

        blocked_utility = blocked_client._utility
        ctx = blocked_utility.make_context({
            "opname": "load",
            "client": blocked_client,
            "utility": blocked_utility,
        }, None)

        fetchdef = {"method": "GET", "headers": {}}
        _, err = blocked_utility.fetcher(ctx, "http://example.com/test", fetchdef)
        assert err is not None
        assert "blocked" in str(err).lower()

    def test_make_context_basic(self):
        def subject(vin):
            if not isinstance(vin, dict):
                return None
            ctx = utility.make_context(vin, None)
            out = {
                "id": ctx.id,
            }
            if ctx.op is not None:
                out["op"] = {
                    "name": ctx.op.name,
                    "input": ctx.op.input,
                }
            return out

        runsection('makeContext', subject)

    def test_make_fetch_def_basic(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = PlaystationStoreApi2Spec({
            "base": "http://localhost:8080",
            "prefix": "/api",
            "path": "items/{id}",
            "suffix": "",
            "params": {"id": "item01"},
            "query": {},
            "headers": {"content-type": "application/json"},
            "method": "GET",
            "step": "start",
        })
        ctx.result = PlaystationStoreApi2Result({})

        fetchdef, err = utility.make_fetch_def(ctx)
        assert err is None
        assert fetchdef["method"] == "GET"
        url = fetchdef.get("url", "")
        assert "/api/items/item01" in url
        assert fetchdef["headers"]["content-type"] == "application/json"
        assert fetchdef.get("body") is None

    def test_make_fetch_def_with_body(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = PlaystationStoreApi2Spec({
            "base": "http://localhost:8080",
            "prefix": "",
            "path": "items",
            "suffix": "",
            "params": {},
            "query": {},
            "headers": {},
            "method": "POST",
            "step": "start",
            "body": {"name": "test"},
        })
        ctx.result = PlaystationStoreApi2Result({})

        fetchdef, err = utility.make_fetch_def(ctx)
        assert err is None
        assert fetchdef["method"] == "POST"
        body_str = fetchdef.get("body")
        assert isinstance(body_str, str)
        assert '"name"' in body_str

    def test_make_options_basic(self):
        def subject(vin):
            if not isinstance(vin, dict):
                vin = {}
            ctx = utility.make_context({
                "options": vin.get("options"),
                "config": vin.get("config"),
            }, None)
            ctx.client = client
            ctx.utility = utility
            return utility.make_options(ctx)

        runsection('makeOptions', subject)

    def test_make_request_basic(self):
        runsection('makeRequest',
                   lambda ctx: _unwrap(utility.make_request(ctx)))

    def test_make_response_basic(self):
        runsection('makeResponse',
                   lambda ctx: _unwrap(utility.make_response(ctx)))

    def test_make_result_basic(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = PlaystationStoreApi2Spec({
            "base": "http://localhost:8080",
            "prefix": "/api",
            "path": "items/{id}",
            "suffix": "",
            "params": {"id": "item01"},
            "query": {},
            "headers": {},
            "method": "GET",
            "step": "start",
        })
        ctx.result = PlaystationStoreApi2Result({
            "ok": True,
            "status": 200,
            "statusText": "OK",
            "headers": {},
            "resdata": {"id": "item01", "name": "Test"},
        })

        result, err = utility.make_result(ctx)
        assert err is None
        assert result.status == 200

    def test_make_result_no_spec(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = None
        ctx.result = PlaystationStoreApi2Result({
            "ok": True,
            "status": 200,
            "statusText": "OK",
            "headers": {},
        })

        _, err = utility.make_result(ctx)
        assert err is not None

    def test_make_result_no_result(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = PlaystationStoreApi2Spec({"step": "start"})
        ctx.result = None

        _, err = utility.make_result(ctx)
        assert err is not None

    def test_make_spec_basic(self):
        setup = spec.get('makeSpec', {}).get('DEF', {}).get('setup', {})
        spec_client = PlaystationStoreApi2SDK.test(None, setup.get('a') or {})

        def subject(ctx):
            ctx.client = spec_client
            ctx.options = spec_client.options_map()
            return _unwrap(utility.make_spec(ctx))

        runsection('makeSpec', subject)

    def test_make_point_basic(self):
        # Driven from the corpus like every other section (was one
        # hand-written case covering one of this utility's branches; the
        # single-point sanity case is kept below).
        def subject(ctx):
            point, err = utility.make_point(ctx)
            # The corpus asserts refusals by code (`match: {out: {code:
            # ...}}`), so an error is the RESULT here, as in ts where
            # makePoint answers with an Error value.
            return err if err is not None else point

        runsection('makePoint', subject)

    def test_make_point_single(self):
        client = PlaystationStoreApi2SDK.test(None, None)
        utility = client._utility
        ctx = _make_test_ctx(client, utility)
        point = {
            "parts": ["items", "{id}"],
            "args": {"params": []},
            "params": [],
            "alias": {},
            "select": {},
            "active": True,
            "transform": {},
        }
        ctx.op.points = [point]

        _, err = utility.make_point(ctx)
        assert err is None
        assert ctx.point is not None

    def test_make_url_basic(self):
        def subject(ctx):
            if ctx.result is None:
                ctx.result = PlaystationStoreApi2Result({})
            return _unwrap(utility.make_url(ctx))

        runsection('makeUrl', subject)

    def test_operator_basic(self):
        def subject(vin):
            if not isinstance(vin, dict):
                vin = {}
            op = PlaystationStoreApi2Operation(vin)
            return {
                "entity": op.entity,
                "name": op.name,
                "input": op.input,
                "points": op.points,
            }

        runsection('operator', subject)

    def test_param_basic(self):
        runsection('param', lambda ctx, name=None: utility.param(ctx, name))

    def test_prepare_auth_basic(self):
        setup = spec.get('prepareAuth', {}).get('DEF', {}).get('setup', {})
        auth_client = PlaystationStoreApi2SDK.test(None, setup.get('a') or {})

        def subject(ctx):
            ctx.client = auth_client
            return _unwrap(utility.prepare_auth(ctx))

        runsection('prepareAuth', subject)

    def test_prepare_body_basic(self):
        runsection('prepareBody', lambda ctx: utility.prepare_body(ctx))

    def test_prepare_headers_basic(self):
        runsection('prepareHeaders', lambda ctx: utility.prepare_headers(ctx))

    def test_prepare_method_basic(self):
        runsection('prepareMethod', lambda ctx: utility.prepare_method(ctx))

    def test_prepare_params_basic(self):
        runsection('prepareParams', lambda ctx: utility.prepare_params(ctx))

    def test_prepare_path_basic(self):
        runsection('preparePath', lambda ctx: utility.prepare_path(ctx))

    def test_prepare_query_basic(self):
        runsection('prepareQuery', lambda ctx: utility.prepare_query(ctx))

    def test_result_basic_basic(self):
        def subject(ctx):
            result = utility.result_basic(ctx)
            out = {
                "status": result.status,
                "statusText": result.status_text,
            }
            if result.err is not None:
                out["err"] = {
                    "message": str(result.err),
                }
            return out

        runsection('resultBasic', subject)

    def test_result_body_basic(self):
        runsection('resultBody', lambda ctx: utility.result_body(ctx))

    def test_result_headers_basic(self):
        runsection('resultHeaders', lambda ctx: utility.result_headers(ctx))

    def test_transform_request_basic(self):
        runsection('transformRequest',
                   lambda ctx: utility.transform_request(ctx))

    def test_transform_response_basic(self):
        runsection('transformResponse',
                   lambda ctx: utility.transform_response(ctx))

-- PlaystationStoreApi2 SDK primary utility test
--
-- Corpus sections run through the vendored omni runner, via the resolver
-- in test/omni.lua (struct-runner shape over native vendored omni). The
-- inline corpus engine this file used to carry is retired: omni resolves
-- arguments, applies the null rules, and enforces out/err/match - the
-- subjects below only adapt each utility's calling convention.
--
-- Three conventions to know when adding a section:
--
-- - Utilities that answer as a (value, err) PAIR go through `unwrap`,
--   which raises the err so omni can match it against `err:` expectations.
--   Utilities that answer bare values are passed straight through.
--
-- - A subject receives omni's RESOLVED arguments (the entry's ctx map, or
--   its `in`/`args` values), not the raw entry. The ctx map arrives in
--   the SDK's value model; `make_ctx_from_map` materialises the real
--   Context from it, exactly as the retired engine did.
--
-- - `match: {ctx: ...}` assertions read the entry's ctx AFTER the subject
--   ran, so a subject whose section asserts on context state writes the
--   relevant live-context fields back onto the ctx map it received - the
--   resolver splices those writebacks into the entry omni matches on.

local sdk = require("playstation-store-api2_sdk")
local omni = require("test.omni")
local Context = require("core.context")
local Spec = require("core.spec")
local Result = require("core.result")
local Response = require("core.response")
local Operation = require("core.operation")
local BaseFeature = require("feature.base_feature")
local PlaystationStoreApi2Error = require("core.error")


-- Resolved against test/omni.lua's own directory, so the suite works from
-- any working directory.
local TEST_JSON_FILE = "../../.sdk/test/test.json"


local runner = omni.makeRunner(TEST_JSON_FILE, sdk.test(nil, nil))
local run = runner("primary")

local spec = run.spec
local runset = run.runset
local runsetflags = run.runsetflags

-- Under the old inline runner the suite drove the SDK directly; under omni
-- the runpack's client is the read-through provider wrapping it. This
-- suite treats the client as the SDK - so unwrap the real instance
-- (mirrors ts/py).
local client = run.client.sdk
local utility = client:get_utility()


-- Navigate into nested map by keys
local function get_spec(base, ...)
  local cur = base
  local keys = { ... }
  for _, key in ipairs(keys) do
    if type(cur) ~= "table" then
      return nil
    end
    cur = cur[key]
  end
  if type(cur) == "table" then
    return cur
  end
  return nil
end


-- Sections deliberately left empty in the shared corpus
-- (.sdk/test/primary/<name>.aon carries a PENDING header). Everything else
-- MUST contribute cases.
local PENDING = {
  fetcher = true,
  makeFetchDef = true,
  makeResult = true,
  featureAdd = true,
  featureHook = true,
  featureInit = true,
}


-- Run one corpus section, failing loudly when it would run ZERO cases. A
-- renamed section or a fixture that compiled to an empty `set` used to
-- pass silently, which defeats the point of a shared oracle. EVERY
-- corpus-backed test goes through here (mirrors ts/py).
local function runsection(name, subject)
  local section = get_spec(spec, name)
  assert(section ~= nil,
    "test corpus section '" .. name .. "' missing - check the name " ..
    "against .sdk/test/primary/")
  local basic = get_spec(section, "basic")
  assert(basic ~= nil and type(basic.set) == "table",
    "test corpus section '" .. name .. "' has no basic.set list")
  if #basic.set == 0 and not PENDING[name] then
    error("test corpus section '" .. name .. "' is EMPTY - zero cases " ..
      "would run; add cases, or mark the fixture PENDING in .sdk/test/primary/")
  end
  return runset(basic, subject)
end


-- (value, err) pair convention -> value-or-raise, omni's shape.
local function unwrap(val, err)
  if err ~= nil then
    error(err)
  end
  return val
end


-- Create a context from a JSON map (like makeCtxFromMap in Go)
local function make_ctx_from_map(ctxmap, ctxclient, ctxutility)
  if ctxmap == nil then
    ctxmap = {}
  end

  local ctx = Context.new(ctxmap, nil)

  if ctxclient ~= nil then
    ctx.client = ctxclient
    ctx.utility = ctxutility
  end
  if ctx.options == nil and ctxclient ~= nil then
    ctx.options = ctxclient:options_map()
  end

  -- Handle spec from JSON map
  if type(ctxmap["spec"]) == "table" then
    ctx.spec = Spec.new(ctxmap["spec"])
  end

  -- Handle result from JSON map
  if type(ctxmap["result"]) == "table" then
    local resmap = ctxmap["result"]
    ctx.result = Result.new(resmap)
    if type(resmap["err"]) == "table" then
      local msg = resmap["err"]["message"]
      if type(msg) == "string" then
        ctx.result.err = PlaystationStoreApi2Error.new("", msg, nil)
      end
    end
  end

  -- Handle response from JSON map
  if type(ctxmap["response"]) == "table" then
    local respmap = ctxmap["response"]
    ctx.response = Response.new(respmap)
    if respmap["body"] ~= nil then
      local body_copy = respmap["body"]
      ctx.response.json_func = function() return body_copy end
    end
    if type(respmap["headers"]) == "table" then
      local lower_headers = {}
      for k, v in pairs(respmap["headers"]) do
        lower_headers[string.lower(k)] = v
      end
      ctx.response.headers = lower_headers
    end
  end

  return ctx
end


-- Fix context options
local function fixctx(ctx, ctxclient)
  if ctx ~= nil and ctx.client ~= nil and ctx.options == nil then
    ctx.options = ctx.client:options_map()
  end
end


-- Create an error from a JSON map
local function err_from_map(m)
  if m == nil then
    return nil
  end
  local msg = m["message"]
  if type(msg) ~= "string" or msg == "" then
    return nil
  end
  local code = m["code"] or ""
  return PlaystationStoreApi2Error.new(code, msg, nil)
end


-- Create a basic test context
local function make_test_ctx(ctxclient, ctxutility, overrides)
  local ctxmap = {
    opname = "load",
    client = ctxclient,
    utility = ctxutility,
  }
  if overrides ~= nil then
    for k, v in pairs(overrides) do
      ctxmap[k] = v
    end
  end
  return ctxutility.make_context(ctxmap, ctxclient:get_root_ctx())
end


-- Create a full test context with point and match
local function make_test_full_ctx(ctxclient, ctxutility)
  local ctx = make_test_ctx(ctxclient, ctxutility, nil)
  ctx.point = {
    parts = { "items", "{id}" },
    args = { params = { { name = "id", reqd = true } } },
    params = { "id" },
    alias = {},
    select = {},
    active = true,
    transform = {},
  }
  ctx.match = { id = "item01" }
  ctx.reqmatch = { id = "item01" }
  return ctx
end


describe("PrimaryUtility", function()

  it("exists", function()
    assert.is_not_nil(utility.clean, "clean should not be nil")
    assert.is_not_nil(utility.done, "done should not be nil")
    assert.is_not_nil(utility.make_error, "make_error should not be nil")
    assert.is_not_nil(utility.feature_add, "feature_add should not be nil")
    assert.is_not_nil(utility.feature_hook, "feature_hook should not be nil")
    assert.is_not_nil(utility.feature_init, "feature_init should not be nil")
    assert.is_not_nil(utility.fetcher, "fetcher should not be nil")
    assert.is_not_nil(utility.make_fetch_def, "make_fetch_def should not be nil")
    assert.is_not_nil(utility.make_context, "make_context should not be nil")
    assert.is_not_nil(utility.make_options, "make_options should not be nil")
    assert.is_not_nil(utility.make_request, "make_request should not be nil")
    assert.is_not_nil(utility.make_response, "make_response should not be nil")
    assert.is_not_nil(utility.make_result, "make_result should not be nil")
    assert.is_not_nil(utility.make_point, "make_point should not be nil")
    assert.is_not_nil(utility.make_spec, "make_spec should not be nil")
    assert.is_not_nil(utility.make_url, "make_url should not be nil")
    assert.is_not_nil(utility.param, "param should not be nil")
    assert.is_not_nil(utility.prepare_auth, "prepare_auth should not be nil")
    assert.is_not_nil(utility.prepare_body, "prepare_body should not be nil")
    assert.is_not_nil(utility.prepare_headers, "prepare_headers should not be nil")
    assert.is_not_nil(utility.prepare_method, "prepare_method should not be nil")
    assert.is_not_nil(utility.prepare_params, "prepare_params should not be nil")
    assert.is_not_nil(utility.prepare_path, "prepare_path should not be nil")
    assert.is_not_nil(utility.prepare_query, "prepare_query should not be nil")
    assert.is_not_nil(utility.result_basic, "result_basic should not be nil")
    assert.is_not_nil(utility.result_body, "result_body should not be nil")
    assert.is_not_nil(utility.result_headers, "result_headers should not be nil")
    assert.is_not_nil(utility.transform_request, "transform_request should not be nil")
    assert.is_not_nil(utility.transform_response, "transform_response should not be nil")
  end)


  it("clean-basic", function()
    local ctx = make_test_ctx(client, utility, nil)
    local val = { key = "secret123", name = "test" }
    local cleaned = utility.clean(ctx, val)
    assert.is_not_nil(cleaned, "cleaned should not be nil")
  end)


  it("done-basic", function()
    runsection("done", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      fixctx(ctx, client)
      return unwrap(utility.done(ctx))
    end)
  end)


  it("makeError-basic", function()
    runsection("makeError", function(cin, errmap)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      fixctx(ctx, client)

      local err_val = nil
      if type(errmap) == "table" then
        err_val = err_from_map(errmap)
      end

      return unwrap(utility.make_error(ctx, err_val))
    end)
  end)


  it("makeError-no-throw", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.ctrl.throw_err = false
    ctx.result = Result.new({
      ok = false,
      resdata = { id = "safe01" },
    })

    local out, err = utility.make_error(ctx, ctx:make_error("test_code", "test message"))
    assert.is_nil(err, "expected no error")
    assert.is_not_nil(out, "expected result")
    if type(out) == "table" then
      assert.are.equal("safe01", out["id"])
    else
      error("expected table result, got: " .. type(out))
    end
  end)


  it("featureAdd-basic", function()
    local ctx = make_test_ctx(client, utility, nil)
    local start_len = #client.features

    local feature = BaseFeature.new()
    utility.feature_add(ctx, feature)

    assert.are.equal(start_len + 1, #client.features)
  end)


  it("featureHook-basic", function()
    local hook_client = sdk.test(nil, nil)
    local hook_utility = hook_client:get_utility()
    local ctx = make_test_ctx(hook_client, hook_utility, nil)

    local called = false
    local hook_feature = BaseFeature.new()
    hook_feature.TestHook = function(self_feat, hook_ctx)
      called = true
    end
    hook_client.features = { hook_feature }

    hook_utility.feature_hook(ctx, "TestHook")
    assert.is_true(called, "expected TestHook to be called")
  end)


  it("featureInit-basic", function()
    local init_client = sdk.test(nil, nil)
    local init_utility = init_client:get_utility()
    local ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      initfeat = { active = true },
    }

    local init_called = false
    local feature = BaseFeature.new()
    feature.name = "initfeat"
    feature.active = true
    feature.get_name = function(self_feat) return "initfeat" end
    feature.get_active = function(self_feat) return true end
    feature.init = function(self_feat, init_ctx, options)
      init_called = true
    end

    init_utility.feature_init(ctx, feature)
    assert.is_true(init_called, "expected init to be called")
  end)


  it("featureInit-inactive", function()
    local init_client = sdk.test(nil, nil)
    local init_utility = init_client:get_utility()
    local ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      nofeat = { active = false },
    }

    local init_called = false
    local feature = BaseFeature.new()
    feature.name = "nofeat"
    feature.active = false
    feature.get_name = function(self_feat) return "nofeat" end
    feature.get_active = function(self_feat) return false end
    feature.init = function(self_feat, init_ctx, options)
      init_called = true
    end

    init_utility.feature_init(ctx, feature)
    assert.is_false(init_called, "expected init NOT to be called for inactive feature")
  end)


  it("fetcher-live", function()
    local calls = {}
    local live_client = sdk.new({
      -- Concrete base: a live construction must satisfy any server variables
      -- a templated base URL declares; a literal base sidesteps the requirement.
      base = "http://localhost:8080",
      system = {
        fetch = function(url, fetchdef)
          table.insert(calls, { url = url, init = fetchdef })
          return { status = 200, statusText = "OK" }, nil
        end,
      },
    })
    local live_utility = live_client:get_utility()
    local ctx = live_utility.make_context({
      opname = "load",
      client = live_client,
      utility = live_utility,
    }, nil)

    local fetchdef = { method = "GET", headers = {} }
    local _, err = live_utility.fetcher(ctx, "http://example.com/test", fetchdef)
    assert.is_nil(err, "expected no error")
    assert.are.equal(1, #calls)
    assert.are.equal("http://example.com/test", calls[1]["url"])
  end)


  it("fetcher-blocked-test-mode", function()
    local blocked_client = sdk.new({
      base = "http://localhost:8080",
      system = {
        fetch = function(url, fetchdef)
          return {}, nil
        end,
      },
    })
    blocked_client.mode = "test"

    local blocked_utility = blocked_client:get_utility()
    local ctx = blocked_utility.make_context({
      opname = "load",
      client = blocked_client,
      utility = blocked_utility,
    }, nil)

    local fetchdef = { method = "GET", headers = {} }
    local _, err = blocked_utility.fetcher(ctx, "http://example.com/test", fetchdef)
    assert.is_not_nil(err, "expected error for test mode fetch")
    local err_msg = tostring(err)
    if type(err) == "table" and err.msg ~= nil then
      err_msg = err.msg
    end
    assert.is_truthy(string.find(err_msg, "blocked"),
      "expected error containing 'blocked', got: " .. err_msg)
  end)


  it("makeContext-basic", function()
    runsection("makeContext", function(vin)
      if type(vin) ~= "table" then
        return nil
      end
      local ctx = utility.make_context(vin, nil)
      local out = {
        id = ctx.id,
      }
      if ctx.op ~= nil then
        out["op"] = {
          name = ctx.op.name,
          input = ctx.op.input,
        }
      end
      return out
    end)
  end)


  it("makeFetchDef-basic", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({
      base = "http://localhost:8080",
      prefix = "/api",
      path = "items/{id}",
      suffix = "",
      params = { id = "item01" },
      query = {},
      headers = { ["content-type"] = "application/json" },
      method = "GET",
      step = "start",
    })
    ctx.result = Result.new({})

    local fetchdef, err = utility.make_fetch_def(ctx)
    assert.is_nil(err, "should not be error")
    assert.is_not_nil(fetchdef, "fetchdef should not be nil")
    assert.are.equal("GET", fetchdef["method"])
    local url = fetchdef["url"] or ""
    assert.is_truthy(string.find(url, "/api/items/item01", 1, true),
      "expected url to contain /api/items/item01, got " .. url)
    assert.are.equal("application/json", fetchdef["headers"]["content-type"])
    assert.is_nil(fetchdef["body"], "expected nil body")
  end)


  it("makeFetchDef-with-body", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({
      base = "http://localhost:8080",
      prefix = "",
      path = "items",
      suffix = "",
      params = {},
      query = {},
      headers = {},
      method = "POST",
      step = "start",
      body = { name = "test" },
    })
    ctx.result = Result.new({})

    local fetchdef, err = utility.make_fetch_def(ctx)
    assert.is_nil(err, "should not be error")
    assert.is_not_nil(fetchdef, "fetchdef should not be nil")
    assert.are.equal("POST", fetchdef["method"])
    local body_str = fetchdef["body"]
    assert.is_not_nil(body_str, "expected body")
    assert.are.equal("string", type(body_str))
    assert.is_truthy(string.find(body_str, '"name"', 1, true),
      "expected body to contain name, got " .. tostring(body_str))
  end)


  it("makeOptions-basic", function()
    runsection("makeOptions", function(vin)
      if type(vin) ~= "table" then
        vin = {}
      end
      local ctx = utility.make_context({
        options = vin["options"],
        config = vin["config"],
      }, nil)
      ctx.client = client
      ctx.utility = utility
      return (utility.make_options(ctx))
    end)
  end)


  it("makeRequest-basic", function()
    runsection("makeRequest", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      ctx.options = client:options_map()

      unwrap(utility.make_request(ctx))

      -- Write live-context state back for match checking (the corpus
      -- asserts `__EXISTS__`, so presence is what matters).
      if ctx.response ~= nil then
        cin["response"] = "exists"
      end
      if ctx.result ~= nil then
        cin["result"] = "exists"
      end

      return nil
    end)
  end)


  it("makeResponse-basic", function()
    runsection("makeResponse", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      fixctx(ctx, client)

      unwrap(utility.make_response(ctx))

      -- Write live-context result state back for match checking
      if ctx.result ~= nil then
        cin["result"] = {
          ok = ctx.result.ok,
          status = ctx.result.status,
          statusText = ctx.result.status_text,
          headers = ctx.result.headers,
          body = ctx.result.body,
        }
      end

      return nil
    end)
  end)


  it("makeResult-basic", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({
      base = "http://localhost:8080",
      prefix = "/api",
      path = "items/{id}",
      suffix = "",
      params = { id = "item01" },
      query = {},
      headers = {},
      method = "GET",
      step = "start",
    })
    ctx.result = Result.new({
      ok = true,
      status = 200,
      statusText = "OK",
      headers = {},
      resdata = { id = "item01", name = "Test" },
    })

    local result, err = utility.make_result(ctx)
    assert.is_nil(err, "expected no error")
    assert.is_not_nil(result, "expected result")
    assert.are.equal(200, result.status)
  end)


  it("makeResult-no-spec", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = nil
    ctx.result = Result.new({
      ok = true,
      status = 200,
      statusText = "OK",
      headers = {},
    })

    local _, err = utility.make_result(ctx)
    assert.is_not_nil(err, "expected error for nil spec")
  end)


  it("makeResult-no-result", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({ step = "start" })
    ctx.result = nil

    local _, err = utility.make_result(ctx)
    assert.is_not_nil(err, "expected error for nil result")
  end)


  it("makeSpec-basic", function()
    local setup_opts = omni.tostruct(get_spec(spec, "makeSpec", "DEF", "setup", "a"))
    local spec_client = sdk.test(nil, setup_opts)
    local spec_utility = spec_client:get_utility()

    runsection("makeSpec", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, spec_client, spec_utility)
      ctx.options = spec_client:options_map()

      unwrap(utility.make_spec(ctx))

      -- Write live-context spec state back for match checking
      if ctx.spec ~= nil then
        cin["spec"] = {
          base = ctx.spec.base,
          prefix = ctx.spec.prefix,
          suffix = ctx.spec.suffix,
          method = ctx.spec.method,
          params = ctx.spec.params,
          query = ctx.spec.query,
          headers = ctx.spec.headers,
          step = ctx.spec.step,
        }
      end

      return nil
    end)
  end)


  it("makePoint-basic", function()
    local ctx = make_test_ctx(client, utility, nil)
    local point = {
      parts = { "items", "{id}" },
      args = { params = {} },
      params = {},
      alias = {},
      select = {},
      active = true,
      transform = {},
    }
    ctx.op.points = { point }

    local _, err = utility.make_point(ctx)
    assert.is_nil(err, "expected no error")
    assert.is_not_nil(ctx.point, "expected point to be set")
  end)


  it("makeUrl-basic", function()
    runsection("makeUrl", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      if ctx.result == nil then
        ctx.result = Result.new({})
      end
      return unwrap(utility.make_url(ctx))
    end)
  end)


  it("operator-basic", function()
    runsection("operator", function(vin)
      if type(vin) ~= "table" then
        vin = {}
      end
      local op = Operation.new(vin)
      return {
        entity = op.entity,
        name = op.name,
        input = op.input,
        points = op.points,
      }
    end)
  end)


  it("param-basic", function()
    runsection("param", function(cin, paramdef)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)

      local result = utility.param(ctx, paramdef)

      -- Write spec alias back for `match: {ctx: {spec: {alias: ...}}}`
      if ctx.spec ~= nil and ctx.spec.alias ~= nil then
        if type(cin["spec"]) ~= "table" then
          cin["spec"] = {}
        end
        cin["spec"]["alias"] = ctx.spec.alias
      end

      return result
    end)
  end)


  it("prepareAuth-basic", function()
    local setup_opts = omni.tostruct(get_spec(spec, "prepareAuth", "DEF", "setup", "a"))
    local auth_client = sdk.test(nil, setup_opts)
    local auth_utility = auth_client:get_utility()

    runsection("prepareAuth", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, auth_client, auth_utility)
      fixctx(ctx, auth_client)

      unwrap(utility.prepare_auth(ctx))

      -- Write live-context spec headers back for match checking
      if ctx.spec ~= nil then
        cin["spec"] = {
          headers = ctx.spec.headers,
        }
      end

      return nil
    end)
  end)


  it("prepareBody-basic", function()
    runsection("prepareBody", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      fixctx(ctx, client)
      return (utility.prepare_body(ctx))
    end)
  end)


  it("prepareHeaders-basic", function()
    runsection("prepareHeaders", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      return (utility.prepare_headers(ctx))
    end)
  end)


  it("prepareMethod-basic", function()
    runsection("prepareMethod", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      return (utility.prepare_method(ctx))
    end)
  end)


  it("prepareParams-basic", function()
    runsection("prepareParams", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      return (utility.prepare_params(ctx))
    end)
  end)


  it("preparePath-basic", function()
    runsection("preparePath", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      return (utility.prepare_path(ctx))
    end)
  end)


  it("preparePath-single", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.point = {
      parts = { "items" },
      args = { params = {} },
    }

    local path = utility.prepare_path(ctx)
    assert.are.equal("items", path)
  end)


  it("prepareQuery-basic", function()
    runsection("prepareQuery", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      return (utility.prepare_query(ctx))
    end)
  end)


  it("resultBasic-basic", function()
    runsection("resultBasic", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)
      fixctx(ctx, client)

      local result = utility.result_basic(ctx)

      local out = {
        status = result.status,
        statusText = result.status_text,
      }
      if result.err ~= nil then
        local err_msg = tostring(result.err)
        if type(result.err) == "table" and result.err.msg ~= nil then
          err_msg = result.err.msg
        end
        out["err"] = {
          message = err_msg,
        }
      end

      return out
    end)
  end)


  it("resultBody-basic", function()
    runsection("resultBody", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)

      utility.result_body(ctx)

      -- Write live-context result state back for match checking
      if ctx.result ~= nil then
        cin["result"] = {
          body = ctx.result.body,
        }
      end

      return nil
    end)
  end)


  it("resultHeaders-basic", function()
    runsection("resultHeaders", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)

      utility.result_headers(ctx)

      -- Write live-context result state back for match checking
      if ctx.result ~= nil then
        cin["result"] = {
          headers = ctx.result.headers,
        }
      end

      return nil
    end)
  end)


  it("transformRequest-basic", function()
    runsection("transformRequest", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)

      local result = utility.transform_request(ctx)

      -- Write the step change back for match checking
      if ctx.spec ~= nil and type(cin["spec"]) == "table" then
        cin["spec"]["step"] = ctx.spec.step
      end

      return result
    end)
  end)


  it("transformResponse-basic", function()
    runsection("transformResponse", function(cin)
      if type(cin) ~= "table" then
        cin = {}
      end
      local ctx = make_ctx_from_map(cin, client, utility)

      local result = utility.transform_response(ctx)

      -- Write the step change back for match checking
      if ctx.spec ~= nil and type(cin["spec"]) == "table" then
        cin["spec"]["step"] = ctx.spec.step
      end

      return result
    end)
  end)

end)

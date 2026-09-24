-- PlaystationStoreApi2 SDK pipeline test
--
-- Direct unit tests for the operation-pipeline utilities. The generated
-- entity tests exercise the happy path; these drive the error and edge
-- branches (missing spec/response/result, 4xx handling, transport
-- failures, feature ordering, auth header shaping) that a normal
-- success-path op never reaches. All utilities are reached through the
-- registered Utility type, so this suite is API-agnostic.
--
-- Adaptations from the TS suite (noted per case below):
-- - Lua utilities return `(value, err)` pairs instead of Error instances,
--   so error assertions check the second return value's `code`.
-- - `done`/`make_error` return errors rather than throwing.
-- - A body-parse exception test is inapplicable: the Lua `result_body`
--   calls `json_func` directly (transport json functions are plain Lua
--   closures, not deserialisers that can throw on re-read).

require("utility.register")

local vs = require("utility.struct.struct")
local Utility = require("core.utility_type")
local Context = require("core.context")
local Spec = require("core.spec")
local Result = require("core.result")
local Response = require("core.response")
local Operation = require("core.operation")
local BaseFeature = require("feature.base_feature")
local PlaystationStoreApi2Error = require("core.error")


local ALLOW = {
  op = "load,list,create,update,remove",
  method = "GET,PUT,POST,PATCH,DELETE",
}


-- Transport-shaped response with a re-readable body + plain lowercase
-- header table.
local function transport_resp(status, data, headers)
  local h = {}
  for k, v in pairs(headers or {}) do
    h[string.lower(k)] = v
  end
  return {
    status = status,
    statusText = status < 400 and "OK" or "ERR",
    body = "body",
    json = function() return data end,
    headers = h,
  }
end


local function base_ctx(over)
  over = over or {}
  local ctx = Context.new({ opname = over.opname or "" }, nil)
  ctx.utility = over.utility or Utility.new()
  if over.client ~= nil then
    ctx.client = over.client
  end
  if over.op ~= nil then
    ctx.op = over.op
  end
  ctx.options = over.options or { allow = ALLOW }
  return ctx
end


describe("pipeline", function()

  describe("feature order", function()
    -- Feature #2: options.feature accepts an ordered LIST (developer add-order)
    -- or a map (defaults test-first); make_options records the resolved order
    -- in __derived__.featureorder.

    local function resolve(feature)
      local ctx = Context.new({}, nil)
      ctx.utility = Utility.new()
      ctx.options = { feature = feature }
      ctx.config = { options = {} }
      local opts = ctx.utility.make_options(ctx)
      return table.concat(opts["__derived__"].featureorder, ",")
    end

    it("map form is ordered test-first", function()
      assert.are.equal("test,metrics", resolve({
        metrics = { active = true },
        test = { active = true },
      }))
    end)

    it("list form preserves the explicit order", function()
      assert.are.equal("metrics,test", resolve({
        { name = "metrics", active = true },
        { name = "test", active = true },
      }))
    end)

    it("map form with no test orders deterministically", function()
      assert.are.equal("cache,retry", resolve({
        retry = { active = true },
        cache = { active = true },
      }))
    end)
  end)

  describe("makePoint + makeSpec", function()

    it("make_point rejects a disallowed operation", function()
      local ctx = base_ctx({
        op = Operation.new({ name = "nope" }),
        options = { allow = { op = "load" } },
      })
      local _, err = ctx.utility.make_point(ctx)
      assert.are.equal("point_op_allow", err.code)
    end)

    it("make_point rejects an operation with no endpoints", function()
      local ctx = base_ctx({ op = Operation.new({ name = "load" }) })
      local _, err = ctx.utility.make_point(ctx)
      assert.are.equal("point_no_points", err.code)
    end)

    it("make_point returns the single point", function()
      local point = { method = "GET", parts = { "a" } }
      local ctx = base_ctx({
        op = Operation.new({ name = "load", points = { point } }),
      })
      local out, err = ctx.utility.make_point(ctx)
      assert.is_nil(err)
      assert.are.equal(point, out)
      assert.are.equal(point, ctx.point)
    end)

    it("make_point short-circuits a feature-supplied point", function()
      local preset = { method = "GET" }
      local ctx = base_ctx({})
      ctx.out["point"] = preset
      local out, err = ctx.utility.make_point(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)

    it("make_point surfaces a feature-supplied error (rbac short-circuit)", function()
      local denial = PlaystationStoreApi2Error.new("rbac_denied", "denied", nil)
      local ctx = base_ctx({})
      ctx.out["point"] = denial
      local out, err = ctx.utility.make_point(ctx)
      assert.is_nil(out)
      assert.are.equal("rbac_denied", err.code)
    end)

    it("make_spec short-circuits a feature-supplied spec", function()
      local preset = { method = "GET" }
      local ctx = base_ctx({})
      ctx.out["spec"] = preset
      local out, err = ctx.utility.make_spec(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
      assert.are.equal(preset, ctx.spec)
    end)
  end)


  describe("makeResponse", function()

    it("guards missing spec / response / result", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      ctx.response = Response.new({})
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_response(ctx)
      assert.are.equal("response_no_spec", err.code)

      ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = nil
      ctx.result = Result.new({})
      _, err = ctx.utility.make_response(ctx)
      assert.are.equal("response_no_response", err.code)

      ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new({})
      ctx.result = nil
      _, err = ctx.utility.make_response(ctx)
      assert.are.equal("response_no_result", err.code)
    end)

    it("a 4xx response sets result.err and copies headers", function()
      local ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new(transport_resp(404, nil, { ["x-a"] = "1" }))
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_response(ctx)
      assert.is_nil(err)
      assert.is_not_nil(ctx.result.err)
      assert.are.equal(404, ctx.result.status)
      assert.are.equal("1", ctx.result.headers["x-a"])
    end)

    it("a 2xx response parses the body and marks ok", function()
      local ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new(transport_resp(200, { v = 1 }))
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_response(ctx)
      assert.is_nil(err)
      assert.is_true(ctx.result.ok)
      assert.are.equal(1, ctx.result.body.v)
    end)

    it("records to ctrl.explain when explain is on", function()
      local ctx = base_ctx({})
      ctx.ctrl.explain = {}
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new(transport_resp(200, { v = 2 }))
      ctx.result = Result.new({})
      ctx.utility.make_response(ctx)
      assert.is_not_nil(ctx.ctrl.explain["result"])
    end)

    it("short-circuits when a feature already supplied the response", function()
      local preset = Response.new(transport_resp(299))
      local ctx = base_ctx({})
      ctx.out["response"] = preset
      local out, err = ctx.utility.make_response(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)
  end)


  describe("makeResult", function()

    it("guards missing spec / result", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_result(ctx)
      assert.are.equal("result_no_spec", err.code)

      ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.result = nil
      _, err = ctx.utility.make_result(ctx)
      assert.are.equal("result_no_result", err.code)
    end)

    it("list op wraps resdata into entity instances", function()
      local made = {}
      local entity = {}
      function entity:make()
        local ent = {}
        function ent:data_set(d)
          table.insert(made, d)
        end
        return ent
      end

      local ctx = base_ctx({ opname = "list" })
      ctx.entity = entity
      ctx.spec = Spec.new({ step = "s" })
      ctx.result = Result.new({ resdata = { { a = 1 }, { a = 2 } } })

      local r, err = ctx.utility.make_result(ctx)
      assert.is_nil(err)
      assert.are.equal(2, #r.resdata)
      assert.are.equal(2, #made)
    end)

    it("an empty list yields an empty resdata table", function()
      local entity = {}
      function entity:make()
        local ent = {}
        function ent:data_set(_) end
        return ent
      end

      local ctx = base_ctx({ opname = "list" })
      ctx.entity = entity
      ctx.spec = Spec.new({ step = "s" })
      ctx.result = Result.new({ resdata = {} })

      local r, err = ctx.utility.make_result(ctx)
      assert.is_nil(err)
      assert.are.equal(0, #r.resdata)
    end)

    it("short-circuits on a preset result", function()
      local preset = { ok = true }
      local ctx = base_ctx({})
      ctx.out["result"] = preset
      local out, err = ctx.utility.make_result(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)
  end)


  describe("makeRequest", function()

    local function request_ctx(fetcher)
      local u = Utility.new()
      if fetcher ~= nil then
        u.fetcher = fetcher
      end
      local ctx = base_ctx({ utility = u })
      ctx.spec = Spec.new({
        step = "s",
        method = "GET",
        headers = {},
        base = "http://h",
        prefix = "",
        suffix = "",
        parts = { "a" },
      })
      return ctx
    end

    it("guards a missing spec", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      local _, err = ctx.utility.make_request(ctx)
      assert.are.equal("request_no_spec", err.code)
    end)

    it("a nil transport result becomes a response error", function()
      local ctx = request_ctx(function() return nil, nil end)
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.is_not_nil(r.err)
    end)

    it("a transport error is carried on the response", function()
      local boom = PlaystationStoreApi2Error.new("boom", "boom", nil)
      local ctx = request_ctx(function() return nil, boom end)
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.are.equal(boom, r.err)
    end)

    it("a normal transport response is wrapped", function()
      local ctx = request_ctx(function() return transport_resp(200, { a = 1 }), nil end)
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.are.equal(200, r.status)
    end)

    it("records the fetchdef to ctrl.explain", function()
      local ctx = request_ctx(function() return transport_resp(200, {}), nil end)
      ctx.ctrl.explain = {}
      ctx.utility.make_request(ctx)
      assert.is_not_nil(ctx.ctrl.explain["fetchdef"])
    end)

    it("a fetchdef error surfaces as a response error", function()
      local ctx = request_ctx(nil)
      ctx.utility.make_fetch_def = function(_c)
        return nil, PlaystationStoreApi2Error.new("fetchdef_boom", "boom", nil)
      end
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.is_not_nil(r.err)
      assert.are.equal("fetchdef_boom", r.err.code)
    end)

    it("short-circuits a feature-supplied request", function()
      local preset = Response.new(transport_resp(201))
      local ctx = base_ctx({})
      ctx.out["request"] = preset
      local out, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)
  end)


  describe("makeFetchDef", function()

    it("guards a missing spec", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      local _, err = ctx.utility.make_fetch_def(ctx)
      assert.are.equal("fetchdef_no_spec", err.code)
    end)

    it("serialises a table body to JSON and inits a missing result", function()
      local ctx = base_ctx({})
      ctx.result = nil
      ctx.spec = Spec.new({
        step = "s",
        method = "POST",
        headers = {},
        base = "http://h",
        prefix = "",
        suffix = "",
        parts = { "a" },
        body = { x = 1 },
      })
      local fd, err = ctx.utility.make_fetch_def(ctx)
      assert.is_nil(err)
      assert.are.equal("string", type(fd["body"]))
      assert.is_truthy(string.find(fd["url"], "http://h", 1, true))
      assert.is_not_nil(ctx.result) -- result was lazily created
    end)
  end)


  describe("makeError + done", function()

    it("done returns resdata on success", function()
      local ctx = base_ctx({})
      ctx.result = Result.new({ ok = true, resdata = 42 })
      local out, err = ctx.utility.done(ctx)
      assert.is_nil(err)
      assert.are.equal(42, out)
    end)

    -- Adapted: the Lua pipeline returns the error (no throw semantics).
    it("done returns the error when not ok", function()
      local ctx = base_ctx({})
      ctx.result = Result.new({ ok = false })
      local out, err = ctx.utility.done(ctx)
      assert.is_nil(out)
      assert.is_not_nil(err)
    end)

    it("done cleans ctrl.explain on success", function()
      local ctx = base_ctx({})
      ctx.ctrl.explain = { result = { err = "x" } }
      ctx.result = Result.new({ ok = true, resdata = 7 })
      local out = ctx.utility.done(ctx)
      assert.are.equal(7, out)
      assert.is_nil(ctx.ctrl.explain["result"]["err"])
    end)

    it("make_error returns resdata instead of erroring when throw is off", function()
      local ctx = base_ctx({})
      ctx.ctrl.throw_err = false
      ctx.result = Result.new({ ok = false, resdata = "fallback" })
      local out, err = ctx.utility.make_error(ctx, nil)
      assert.is_nil(err)
      assert.are.equal("fallback", out)
    end)

    it("make_error records to ctrl.explain", function()
      local ctx = base_ctx({})
      ctx.ctrl.throw_err = false
      ctx.ctrl.explain = {}
      ctx.result = Result.new({ ok = false })
      ctx.utility.make_error(ctx, nil)
      assert.is_not_nil(ctx.ctrl.explain["err"])
    end)

    it("make_error fires the PreUnexpected hook", function()
      local fired = 0
      local feat = BaseFeature.new()
      feat.PreUnexpected = function(_self, _ctx)
        fired = fired + 1
      end
      local client = { features = { feat } }
      local ctx = base_ctx({ client = client })
      ctx.result = Result.new({ ok = false })
      local _, err = ctx.utility.make_error(ctx,
        PlaystationStoreApi2Error.new("x", "boom", nil))
      assert.is_not_nil(err)
      assert.are.equal(1, fired)
      assert.is_not_nil(ctx.ctrl.err)
    end)
  end)


  describe("feature ordering", function()

    it("feature_add appends to the client feature list", function()
      local client = { features = { { name = "a" }, { name = "b" } } }
      local ctx = { client = client }
      local u = Utility.new()
      u.feature_add(ctx, { name = "z" })
      local names = {}
      for _, f in ipairs(client.features) do
        table.insert(names, f.name)
      end
      assert.are.equal("a,b,z", table.concat(names, ","))
    end)

    -- `_options` on an extend-feature instance positions it relative to an
    -- already-added feature (mirrors the ts featureAdd).
    it("feature_add honours __before__/__after__/__replace__", function()
      local client = { features = {} }
      local ctx = { client = client }
      local u = Utility.new()
      local function names()
        local out = {}
        for _, f in ipairs(client.features) do
          table.insert(out, f.name)
        end
        return table.concat(out, ",")
      end

      u.feature_add(ctx, { name = "a" })
      u.feature_add(ctx, { name = "b" })
      assert.are.equal("a,b", names())

      u.feature_add(ctx, { name = "z1", _options = { __before__ = "b" } })
      assert.are.equal("a,z1,b", names())

      u.feature_add(ctx, { name = "z2", _options = { __after__ = "a" } })
      assert.are.equal("a,z2,z1,b", names())

      u.feature_add(ctx, { name = "z3", _options = { __replace__ = "z1" } })
      assert.are.equal("a,z2,z3,b", names())

      -- An ordering option naming no existing feature falls back to append.
      u.feature_add(ctx, { name = "z4", _options = { __before__ = "missing" } })
      assert.are.equal("a,z2,z3,b,z4", names())
    end)

    it("feature_hook fires hooks in feature-list order", function()
      local order = {}
      local function recorder(name)
        local f = BaseFeature.new()
        f.PreRequest = function(_self, _ctx)
          table.insert(order, name)
        end
        return f
      end
      local client = { features = { recorder("a"), recorder("z") } }
      local u = Utility.new()
      u.feature_hook({ client = client }, "PreRequest")
      assert.are.equal("a,z", table.concat(order, ","))
    end)
  end)


  describe("prepareAuth", function()

    -- A cookie credential as prepare_auth writes it: `<scheme>=K` for the
    -- probe key, with no scheme prefix and nothing else in the bag.
    local function is_cookie_pair(value)
      return "string" == type(value) and nil ~= value:match("^[^=;]+=K$")
    end

    -- Fake client so the exact options.auth / apikey shape is controlled.
    local function auth_ctx(options, spec)
      local ctx = base_ctx({})
      ctx.client = {
        options_map = function(_self)
          return options
        end,
      }
      ctx.spec = spec
      return ctx
    end

    local function auth_bags()
      return Spec.new({ headers = {}, query = {} })
    end

    -- A cookie credential rides the header bag, because a cookie IS a header.
    local function auth_bag(spec, where)
      if "query" == where then return spec.query end
      return spec.headers
    end

    -- `basic = false` is explicit: an HTTP Basic API's generated config
    -- carries `auth.basic: true`, and a client that merges it in takes a
    -- branch needing a secret as well. With none supplied that branch writes
    -- nothing, which the probe would read as a public API.
    local function auth_block(prefix)
      return { prefix = prefix, basic = false }
    end

    -- Run prepare_auth with both containers present and see which one the
    -- generated utility writes to, and under what name. nil means this SDK
    -- places no credential at all - a public API - which is a legitimate
    -- shape, and the tests below assert exactly that instead. `pair` is the
    -- `<scheme>=` lead-in of a COOKIE credential, which rides the header bag
    -- under the key "cookie" instead of taking a header of its own.
    local function auth_probe(options)
      local ctx = auth_ctx(options, auth_bags())
      ctx.utility.prepare_auth(ctx)
      for _, where in ipairs({ "headers", "query" }) do
        for name, value in pairs(auth_bag(ctx.spec, where)) do
          local pair = ""
          if "headers" == where and "cookie" == name and is_cookie_pair(value) then
            pair = value:sub(1, -2)
          end
          return { where = where, name = name, value = value, pair = pair }
        end
      end
      return nil
    end

    local function auth_credential()
      return auth_probe({ apikey = "K", auth = auth_block("Bearer") })
    end

    -- Every credential this SDK could possibly place: both credentials and
    -- Basic switched on, so whichever branch the API has, something lands
    -- unless the API is public.
    local function auth_any_credential()
      return auth_probe({ apikey = "K", secret = "S",
        auth = { prefix = "Bearer", basic = true } })
    end

    local function auth_placed(options, seed)
      local cred = auth_credential()
      local spec = auth_bags()
      if nil ~= cred and nil ~= seed then
        auth_bag(spec, cred.where)[cred.name] = seed
      end
      local ctx = auth_ctx(options, spec)
      ctx.utility.prepare_auth(ctx)
      if nil == cred then return nil end
      return auth_bag(ctx.spec, cred.where)[cred.name]
    end

    it("guards a missing spec", function()
      local ctx = auth_ctx({ auth = auth_block(""), apikey = "K" }, nil)
      local _, err = ctx.utility.prepare_auth(ctx)
      assert.are.equal("auth_no_spec", err.code)
    end)

    -- Without this the cases below cannot fail for an SDK whose credential the
    -- probe misses: every one of them takes the public-API path instead.
    it("the probe finds the credential this SDK places", function()
      assert.are.equal(nil == auth_credential(), nil == auth_any_credential())
    end)

    it("the apikey is placed where this API puts it", function()
      local cred = auth_credential()
      if nil == cred then
        -- A public API places nothing, and that is the whole assertion.
        assert.is_nil(auth_placed({ apikey = "K", auth = auth_block("Bearer") }))
        return
      end
      assert.is_true("headers" == cred.where or "query" == cred.where)
      if "" ~= cred.pair then
        -- A cookie credential is a `<scheme>=<key>` pair, and the scheme name
        -- leaves no room for the option's prefix.
        assert.is_true(is_cookie_pair(cred.value), tostring(cred.value))
        return
      end
      -- A header credential is prefix-joined; a query credential is the raw
      -- key, because a query parameter has nowhere to put a scheme name.
      local want = "Bearer K"
      if "query" == cred.where then want = "K" end
      assert.are.equal(want, cred.value)
    end)

    it("a raw apikey (empty prefix) goes in as-is", function()
      local cred = auth_credential()
      local want = nil
      if nil ~= cred then want = cred.pair .. "K" end
      assert.are.equal(want, auth_placed({ apikey = "K", auth = auth_block("") }))
    end)

    it("an empty apikey drops the credential", function()
      assert.is_nil(auth_placed({ apikey = "", auth = auth_block("Bearer") }, "stale"))
    end)

    it("a public API (no auth block) drops the credential", function()
      assert.is_nil(auth_placed({ apikey = "K" }, "stale"))
    end)

    it("a missing apikey option drops the credential", function()
      assert.is_nil(auth_placed({ auth = auth_block("Bearer") }, "stale"))
    end)
  end)


  describe("result helpers", function()

    it("result_headers with non-table headers yields an empty map", function()
      local ctx = base_ctx({})
      ctx.response = Response.new({ headers = "x" })
      ctx.result = Result.new({})
      ctx.utility.result_headers(ctx)
      assert.are.same({}, ctx.result.headers)
    end)

    it("result_body skips parsing when the body is absent", function()
      local ctx = base_ctx({})
      ctx.response = Response.new({ json = function() return { a = 1 } end })
      ctx.result = Result.new({})
      ctx.utility.result_body(ctx)
      assert.is_nil(ctx.result.body)
    end)
  end)
end)

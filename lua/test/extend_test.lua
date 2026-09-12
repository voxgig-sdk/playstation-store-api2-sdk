-- PlaystationStoreApi2 SDK extend test
--
-- The `extend` option hands feature INSTANCES to the constructor. Every
-- shipped feature's init keeps `self.client = ctx.client`, so an instance
-- left in `options.extend` after construction made the options map
-- CYCLIC (client.options.extend[1].client == client), and options_map()'s
-- clone - which has no cycle guard - blew the stack on the first
-- prepare_auth of any client built that way. Nobody had hit it because no
-- shipped feature is added through extend; the secrets suite is.
--
-- Ungated on purpose: it needs no feature but the always-present base, so
-- it runs in every generated SDK.

local sdk = require("playstation-store-api2_sdk")
local BaseFeature = require("feature.base_feature")


-- The smallest feature that reproduces the cycle: an init that keeps the
-- client, as every shipped feature does.
local function probe_feature()
  local Probe = {}
  Probe.__index = Probe
  setmetatable(Probe, { __index = BaseFeature })

  local self = setmetatable(BaseFeature.new(), Probe)
  self.name = "probe"
  self.inited = false

  function Probe:init(ctx, _options)
    self.client = ctx.client
    self.inited = true
  end

  return self
end


-- A LIVE client, so the request path runs prepare_auth for real: the test
-- feature's mock would not change the options_map call, but the live path
-- is the one every consumer takes. The transport records and answers.
local function live_client(extend)
  local calls = 0
  local client = sdk.new({
    base = "http://extend.test/api",
    system = {
      fetch = function(_url, _fetchdef)
        calls = calls + 1
        return {
          status = 200, statusText = "OK", headers = {},
          json = function() return { ok = true } end,
        }, nil
      end,
    },
    feature = { probe = { active = true } },
    extend = extend,
  })
  return client, function() return calls end
end


describe("extend", function()

  it("installs the instance and initialises it", function()
    local probe = probe_feature()
    local client = live_client({ probe })

    assert.is_true(probe.inited, "the extend feature's init did not run")

    local found = false
    for _, f in ipairs(client.features) do
      if f == probe then found = true end
    end
    assert.is_true(found, "the extend instance is not on client.features")
  end)

  it("consumes options.extend so the options map is not cyclic", function()
    local probe = probe_feature()
    local client = live_client({ probe })

    -- Before the fix this was `stack overflow` out of struct.lua's clone.
    local opts = client:options_map()
    assert.is_table(opts)
    assert.is_nil(opts.extend,
      "options.extend must be consumed by the constructor, not kept")
    assert.is_nil(client:get_root_ctx().options.extend,
      "the root context shares the options table and must lose the key too")
  end)

  it("a request runs prepare_auth over the options with the feature installed", function()
    local probe = probe_feature()
    local client, calls = live_client({ probe })

    local res = client:direct({ path = "/ping" })
    assert.is_table(res)
    assert.is_true(res.ok, "the direct request failed: " .. tostring(res.err))
    assert.are.equal(1, calls(), "the request did not reach the transport once")
  end)

  it("a feature can still be added when extend is absent", function()
    local client, calls = live_client(nil)
    local res = client:direct({ path = "/ping" })
    assert.is_true(res.ok)
    assert.are.equal(1, calls())
  end)
end)

-- PlaystationStoreApi2 SDK omni runner smoke test
--
-- Smoke tests for the vendored omni runner itself: a runner that cannot
-- FAIL a bad entry would turn every corpus suite vacuously green, so pin
-- the failure paths, not just the happy one. (Lua peer of ts's
-- test/omni.test.ts and py's test_omni_smoke.py.)

local assert = require("luassert")

local sdk = require("project-name-_sdk")
local omni = require("test.omni")

local makeRunner, isomnierror = omni.makeRunner, omni.isomnierror
local map, list = omni.map, omni.list


-- A minimal in-memory spec: no fixture file, no OMNI block (lenient v0,
-- like the shared corpus). Built in omni's own value model - a plain lua
-- table is invisible to its walkers.
local function makespec()
  return map({
    primary = map({
      smoke = map({
        basic = map({
          set = list({
            map({ ["in"] = 1, out = 2 }),
            map({ ["in"] = 41, out = 42 }),
          }),
        }),
        bad = map({
          set = list({
            map({ ["in"] = 1, out = 999 }),
          }),
        }),
        err = map({
          set = list({
            map({ ["in"] = 0, err = "zero refused" }),
          }),
        }),
      }),
    }),
  })
end


local function inc(n)
  if 0 == n then
    error("smoke: zero refused")
  end
  return n + 1
end


-- Run `fn`, requiring it to raise an omni failure whose message contains
-- `want`.
local function mustfail(fn, want)
  local ok, err = pcall(fn)
  assert.is_false(ok, "expected the runner to FAIL, but it passed")
  assert.is_true(isomnierror(err),
    "expected an omni error, got: " .. tostring(err))
  assert.is_truthy(string.find(tostring(err), want, 1, true),
    "expected failure containing '" .. want .. "', got: " .. tostring(err))
end


describe("omni smoke", function()

  local function pack()
    local runner = makeRunner(makespec(), sdk.test(nil, nil))
    return runner("smoke")
  end


  it("runset passes a correct subject", function()
    local R = pack()
    R.runset(R.spec.basic, inc)
  end)


  it("runset fails a wrong result with an omni error", function()
    local R = pack()
    mustfail(function()
      R.runset(R.spec.bad, inc)
    end, "result mismatch")
  end)


  it("an expected error is matched, and a missing expected error fails", function()
    local R = pack()

    -- The expected error occurs: passes.
    R.runset(R.spec.err, inc)

    -- The expected error does NOT occur: must fail.
    local R2 = pack()
    mustfail(function()
      R2.runset(R2.spec.err, function(n)
        return n
      end)
    end, "expected error did not occur")
  end)

end)

-- PlaystationStoreApi2 SDK corpus test runner: vendored @voxgig/omni driven through
-- its NATIVE API (`makeRunner(specref, provider)`), presented to the corpus
-- tests in the struct-runner shape they already use (`R.spec`, `R.runset`,
-- `R.runsetflags`, `R.client`). No compat shim is vendored: the adapter
-- below IS the whole bridge, per language, per the vendor-tag rollout
-- (docs/design/vendor-tag-rollout.md, Decision 4). It is the lua peer of
-- tm/ts/test/omni.ts / tm/py/test/omni.py, and a port of upstream omni's
-- own lua struct shim (voxgig/omni lua/compat/struct.lua) onto the REAL
-- generated SDK.
--
-- Four local decisions, all required:
--
-- 1. SPEC PATH. omni's own spec loading expects a usable path. A relative
--    path is absolutized against THIS module's directory (test/), so the
--    existing '../../.sdk/test/test.json' constant keeps working verbatim
--    wherever the suite is run from.
--
-- 2. PROVIDER DELEGATION. Corpus-driven contexts get `ctx.client` set to
--    the runner's provider (omni overwrites it on any ctx/args map entry).
--    A five-hook provider object HIDES the live SDK from the generated
--    utilities that reach through it - prepare_auth and prepare_headers via
--    `ctx.client:options_map()`, feature_add appending to client.features.
--    So the provider here is a READ-THROUGH view of the live SDK instance:
--    a table holding the omni hooks whose metatable delegates reads to the
--    SDK (`__index`) and routes writes onto it (`__newindex`) - the lua
--    spelling of ts's prototype delegation. (Upstream omni#56 tracks
--    giving the stock provider the same shape.)
--
-- 3. TWO VALUE MODELS, converted at the subject boundary. omni marks maps
--    and lists by METATABLE IDENTITY and models null/absent as sentinel
--    tables (a lua table cannot hold nil); the SDK and the vendored struct
--    speak dkjson's `__jsontype` convention with plain lua nil. Neither
--    recognises the other, so `wrapsubject` converts every argument on the
--    way in (tostruct) and the result on the way out (toomni), splicing
--    argument mutations back where omni's `match` can see them. This is
--    the port of upstream's compat shim, with ONE deliberate change: a
--    table that belongs to neither model (a live SDK object - the
--    provider, a Context, the utility) passes through BY REFERENCE as a
--    leaf, so subjects keep real object identity through `ctx.client`.
--
-- 4. NO-VALUE ARITY (the zero-argument correction six upstream compat
--    shims carry). An entry with no `in`/`args`/`ctx` must reach the
--    subject as NO value, not as one null. omni models absence as an
--    explicit ABSENT sentinel; the vendored struct's own NOVAL sentinel
--    (upstream struct/lua 0.1.1) is what an absent argument becomes, so
--    `typify()` answers T_noval where `typify(nil)` answers T_null. A
--    port without NOVAL gets trailing absent arguments TRIMMED instead,
--    which `select('#', ...)` reads as a zero-arity call.
--
-- THE VENDORED LUA PORT AND THE omni#54 RUNNER FIXES, checked per the
-- rollout: lua's `match` already reads its base directly (no clone), its
-- `errmessage` already keeps a message-bearing table's message (the SDK's
-- error type answers through __tostring), and its walkers recurse only
-- into omni-marked tables, so live cyclic objects are leaves to them. No
-- resolver workaround is needed at this tag; decision 3's leaf rule is
-- what keeps it that way.

local u = require("test.vendor.omni.util")
local Runner = require("test.vendor.omni.runner")
local vs = require("utility.struct.struct")

local _test_dir = debug.getinfo(1, "S").source:match("^@(.+/)") or "./"

local M = {}

M.NULLMARK = u.NULLMARK
M.UNDEFMARK = u.UNDEFMARK
M.EXISTSMARK = u.EXISTSMARK
M.JSON_NULL = u.NULL
M.ABSENT = u.ABSENT

-- omni's own model constructors and error type, re-exported for the smoke
-- test (an in-memory spec must be built in omni's value model).
M.map = u.map
M.list = u.list
M.OmniError = Runner.OmniError
M.isomnierror = Runner.isomnierror

--- The two value models, and the translation between them (decision 3).

local ARRAYMT = { __jsontype = "array" }
local OBJECTMT = { __jsontype = "object" }

--- omni's model -> struct's/SDK's.
---
--- Returns `(value, kind)` where kind is 'value', 'null' or 'absent'.
--- Three states, not two: omni's NULL and ABSENT both become a lua `nil`,
--- but they are NOT interchangeable at the call boundary - an absent
--- argument becomes the port's no-value, a null stays nil.
local function tostruct(val, seen)
  if u.NULL == val then
    return nil, "null"
  end
  if u.ABSENT == val then
    return nil, "absent"
  end
  if "table" ~= type(val) then
    return val, "value"
  end

  -- Decision 3's leaf rule: a table that is not omni-marked is a LIVE
  -- object (the provider, a Context, the utility). It crosses by
  -- reference, keeping identity and methods.
  local islist = u.islist(val)
  if not islist and not u.ismap(val) then
    return val, "value"
  end

  seen = seen or {}
  if nil ~= seen[val] then
    return seen[val], "value"
  end

  local out = setmetatable({}, islist and ARRAYMT or OBJECTMT)
  seen[val] = out

  if islist then
    for index = 1, #val do
      local entry, kind = tostruct(val[index], seen)
      -- A null INSIDE a list has to stay a slot, or the list shortens -
      -- and the slot is the STRING "null", which is what struct/lua's own
      -- runner put there and what the port is written against ("Preserve
      -- null in arrays as the string "null" to avoid nil holes").
      if "value" == kind then
        out[index] = entry
      else
        out[index] = "null"
      end
    end
  else
    for key, entry in pairs(val) do
      local converted, kind = tostruct(entry, seen)
      if "value" == kind then
        out[key] = converted
      end
    end
  end

  return out, "value"
end

--- Convert a value from omni's model into the SDK's (nulls become lua
--- nil), re-exported for test files that read spec sections directly -
--- DEF.setup options handed to `sdk.test`, corpus fixtures cloned before
--- driving a subject by hand.
function M.tostruct(val)
  local out = tostruct(val)
  return out
end

--- struct's/SDK's model -> omni's.
local function toomni(val, seen)
  if "table" ~= type(val) then
    return val
  end
  if u.NULL == val or u.ABSENT == val then
    return val
  end
  -- Already omni-marked: a subject handed its input straight back.
  if u.ismap(val) or u.islist(val) then
    return val
  end

  -- Struct marks with __jsontype; a live object carries some OTHER
  -- metatable and stays a leaf (decision 3). An unmarked plain table is
  -- classified the way struct/lua's own `islist` does it: at least one
  -- key, and the numeric keys are 1..n with nothing else (`count > 0`
  -- matters - an unmarked EMPTY table is a MAP to struct, and calling it
  -- a list turns every `{}` that comes back through merge or clone into
  -- `[]`).
  local mt = getmetatable(val)
  local jsontype = mt and mt.__jsontype
  if nil ~= mt and nil == jsontype then
    return val
  end

  local islist
  if "array" == jsontype then
    islist = true
  elseif "object" == jsontype then
    islist = false
  else
    local count, max = 0, 0
    islist = true
    for key in pairs(val) do
      if "number" ~= type(key) then
        islist = false
        break
      end
      count = count + 1
      if key > max then
        max = key
      end
    end
    islist = islist and 0 < count and max == count
  end

  seen = seen or {}
  if nil ~= seen[val] then
    return seen[val]
  end

  local out = islist and u.list({}) or u.map({})
  seen[val] = out

  if islist then
    for index = 1, #val do
      out[index] = toomni(val[index], seen)
    end
  else
    for key, entry in pairs(val) do
      out[key] = toomni(entry, seen)
    end
  end

  return out
end

--- Replace the CONTENTS of an omni table with another's, keeping the
--- original table's identity and its map/list metatable. Used to write an
--- argument mutation back where omni's `match` can see it.
local function splice(into, from)
  local keys = {}
  for key in pairs(into) do
    keys[#keys + 1] = key
  end
  for _, key in ipairs(keys) do
    into[key] = nil
  end
  for key, value in pairs(from) do
    into[key] = value
  end
end

--- A subject that speaks the SDK's value model on the way in and omni's on
--- the way out. Arity is preserved exactly: `select('#', ...)` is what
--- tells an entry with no `in` (zero arguments) from one with `in: null`
--- (one) - decision 4.
local function wrapsubject(subject, noval)
  if "function" ~= type(subject) then
    return nil
  end
  return function(...)
    local count = select("#", ...)
    local args = table.pack(...)
    local converted, presence = {}, {}
    for index = 1, count do
      local value, kind = tostruct(args[index])
      -- NOT `kind and value or nil`: when `value` is `false` that whole
      -- expression is `nil`, so every `in: false` entry arrived as absent.
      presence[index] = ("absent" ~= kind)
      if "value" == kind then
        converted[index] = value
      end
    end

    -- An absent argument becomes the port's own no-value, so `typify()`
    -- can answer T_noval where `typify(nil)` answers T_null. Without a
    -- sentinel there is nothing to send, so trailing absents shorten the
    -- call instead and the port sees a zero-arity call.
    if nil ~= noval then
      for index = 1, count do
        if not presence[index] then
          converted[index] = noval
        end
      end
    else
      while 0 < count and not presence[count] do
        count = count - 1
      end
    end

    local result = subject(table.unpack(converted, 1, count))

    -- SDK utilities MUTATE the value they are given (result_body rewrites
    -- ctx.result in place), and the corpus checks it via `match`. But
    -- `tostruct` built a copy, so the mutation landed on the copy - splice
    -- the result back into omni's own table, keeping its identity so its
    -- map/list marking survives. Only a converted COPY is written back: a
    -- leaf that crossed by reference (decision 3) mutated in place
    -- already, and self-splicing it would wipe it.
    for index = 1, count do
      local original, mutated = args[index], converted[index]
      if
        "table" == type(original)
        and "table" == type(mutated)
        and original ~= mutated
        and (u.ismap(original) or u.islist(original))
      then
        splice(original, toomni(mutated))
      end
    end

    -- The port's no-value is omni's absent, explicitly.
    if nil ~= noval and noval == result then
      return u.ABSENT
    end
    -- A plain `nil` back from the SDK is ABSENT, not NULL. The port has
    -- one `nil` for both, and the corpus decides which way: measured
    -- upstream over the struct corpus, reading it as null costs 43
    -- entries, reading it as absent costs 6 (named in the struct suite's
    -- drop guards).
    if nil == result then
      return u.ABSENT
    end
    return toomni(result)
  end
end

--- `makeContext` -> `make_context`: corpus subject names are camelCase,
--- the SDK utility is snake_case.
local function snake(name)
  return (name:gsub("%u", function(c)
    return "_" .. c:lower()
  end))
end

--- Read `name` off the SDK's utility the way struct's runner does: the
--- utility itself (either spelling), then the struct utilities.
local function lookup(utility, name)
  if nil == utility then
    return nil
  end
  local found = utility[name]
  if nil == found then
    found = utility[snake(name)]
  end
  if nil == found and nil ~= utility.struct then
    found = utility.struct[name]
  end
  return found
end

--- Wrap the live SDK as an omni provider (decision 2): the omni hooks sit
--- in the table, everything else delegates to the SDK - reads through
--- `__index`, writes through `__newindex`.
local function sdkprovider(client)
  -- The LIVE utility, not the copy `get_utility()` hands out - the corpus
  -- suites reach the struct utilities through `client.utility().struct`
  -- (mirrors ts), so they are attached here once.
  local utility = client._utility
  if nil ~= utility and nil == utility.struct then
    utility.struct = vs
  end

  local noval = nil ~= utility and nil ~= utility.struct
    and utility.struct.NOVAL or nil

  local provider = {}

  provider.sdk = client

  provider.subject = function(name)
    return wrapsubject(lookup(utility, name), noval)
  end

  -- A DEF.client entry becomes another SDK instance - rewrapped with the
  -- same delegating shape, not a plain hook object.
  provider.client = function(options)
    local opts = tostruct(options)
    return sdkprovider(client.test(nil, opts))
  end

  -- omni's resolveargs installs `client` on a contextified map argument;
  -- the utility is added here so corpus contexts carry both (struct's
  -- runner handed its contexts the same pair). The ctx STAYS an omni map -
  -- the subject adapters materialise a real Context from it, and
  -- wrapsubject splices their writebacks into it for `match: {ctx: ...}`.
  provider.contextify = function(val)
    if nil ~= utility and nil ~= utility.contextify then
      val = utility.contextify(val)
    end
    if u.ismap(val) then
      rawset(val, "utility", utility)
    end
    return val
  end

  -- Client options may reference the runner store.
  provider.inject = function(options, store)
    if nil ~= utility and nil ~= utility.struct
      and nil ~= utility.struct.inject then
      utility.struct.inject(options, store)
    end
    return options
  end

  provider.utility = function()
    return utility
  end

  return setmetatable(provider, {
    __index = client,
    __newindex = function(_, key, value)
      client[key] = value
    end,
  })
end


--- struct's makeRunner(testfile, client) signature, backed by vendored
--- omni. Also accepts an already-parsed spec (omni's own capability, in
--- omni's value model), which keeps smoke tests free of fixture files.
function M.makeRunner(testfile, client)
  local specref = testfile
  if "string" == type(testfile) and "/" ~= testfile:sub(1, 1) then
    specref = _test_dir .. testfile
  end

  local provider = sdkprovider(client)
  local runner = Runner.makeRunner(specref, provider)

  local utility = client._utility
  local noval = nil ~= utility and nil ~= utility.struct
    and utility.struct.NOVAL or nil

  return function(name, store)
    local runpack = runner(name, store or u.map({}))

    -- Explicitly passed subjects speak the SDK's model too - the corpus
    -- tests hand most subjects in per-set rather than by name.
    local runsetflags = function(testspec, flags, testsubject)
      return runpack.runsetflags(testspec, flags, wrapsubject(testsubject, noval))
    end

    return {
      spec = runpack.spec,
      runset = function(testspec, testsubject)
        return runsetflags(testspec, {}, testsubject)
      end,
      runsetflags = runsetflags,
      subject = runpack.subject,
      -- The read-through provider: tests treat it as the SDK (its members
      -- all resolve), and omni hands it to corpus contexts as ctx.client.
      client = provider,
    }
  end
end

--- Convert NULLMARK sentinels back into real nulls.
---
--- NOT a delegation to omni's `nullmodifier`, deliberately: omni's
--- RETURNS the replacement value, while struct/lua's `inject` passes this
--- as its `modify` hook and expects it to MUTATE `parent[key]` in place.
--- It writes a real lua `nil` rather than omni's NULL sentinel, because
--- that is what struct's own modifier wrote and what the corpus expects
--- to come back out.
function M.nullModifier(val, key, parent)
  if M.NULLMARK == val then
    parent[key] = nil
  elseif "string" == type(val) then
    parent[key] = (val:gsub(M.NULLMARK, "null"))
  end
end

return M

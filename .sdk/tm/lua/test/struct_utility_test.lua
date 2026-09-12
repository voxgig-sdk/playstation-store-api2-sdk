-- PlaystationStoreApi2 SDK struct utility test
--
-- The struct corpus drives the LIVE SDK's vendored struct utilities
-- through the vendored omni runner, via the resolver in test/omni.lua
-- (struct-runner shape over native vendored omni; test/struct_runner.lua
-- is retired - see docs/design/vendor-tag-rollout.md). Mirrors upstream
-- struct/lua's own test/struct_test.lua at the shared tag.

local assert = require("luassert")

local sdk = require("project-name-_sdk")

local runnerModule = require("test.omni")
local makeRunner, nullModifier = runnerModule.makeRunner, runnerModule.nullModifier
-- Spec entries arrive in the runner's own value model, where a JSON null
-- is a sentinel rather than a lua nil. The skip guards below have to
-- compare against it.
local JSON_NULL = runnerModule.JSON_NULL
local tostructval = runnerModule.tostruct

local TEST_JSON_FILE = "../../.sdk/test/test.json"

----------------------------------------------------------
-- Helper Functions
----------------------------------------------------------

-- Helper function to create an array-like table with metatable
-- @param ... (any) Variable arguments to include in array
-- @return (table) Table with array metatable
local function array(...)
  local t = { ... }
  return setmetatable(t, {
    __jsontype = "array"
  })
end

-- Helper function to create an object-like table with metatable
-- @param t (table) The table to convert to an object (optional)
-- @return (table) Table with object metatable
local function object(t)
  t = t or {}
  return setmetatable(t, {
    __jsontype = "object"
  })
end

----------------------------------------------------------
-- Entries this port cannot express
----------------------------------------------------------

-- Lua has ONE `nil`. The corpus distinguishes JSON null from absent, and
-- a lua table cannot hold a nil at all, so a handful of entries have no
-- representation here. `NOVAL` (vendored struct) covers the ARGUMENT side
-- - `typify()` against `typify(null)` - but not the RESULT side: a
-- function that returns nothing and one that returns JSON null both
-- return `nil`, and the runner reads it as ABSENT (the cheaper side by a
-- wide margin, measured upstream: reading it as null costs 43 entries,
-- reading it as absent costs the few named below).
--
-- Rather than mark whole groups pending and lose the other entries in
-- them, the individual entries are dropped and named here.
--
-- Each drop is GUARDED. Corpus indexes are positional, so if the corpus
-- gains or reorders an entry the guard fires and says so, instead of
-- quietly skipping a different entry and reporting green.
local function dropentries(group, drops)
  assert.is_true(nil ~= group, "corpus group missing")
  local set = group.set
  assert.is_true(nil ~= set, "corpus group has no set")

  -- Descending, so each removal leaves the earlier indexes alone.
  for i = #drops, 1, -1 do
    local drop = drops[i]
    local entry = set[drop.at + 1]
    assert.is_true(
      nil ~= entry and drop.is(entry),
      "corpus moved under a skip: " .. drop.why .. " is no longer at index " .. drop.at
    )
    table.remove(set, drop.at + 1)
  end

  return group
end

-- Helpers the guards use. `dropentries` mutates the spec node in place, so
-- a group must be dropped from once; a second pass would find the entry
-- gone and the guard would say so.
local function isnull(val)
  return JSON_NULL == val
end
local function entryin(entry, path)
  local at = entry["in"]
  for part in path:gmatch("[^%.]+") do
    if type(at) ~= "table" then
      return nil
    end
    at = at[part]
  end
  return at
end

----------------------------------------------------------
-- Test Suite
----------------------------------------------------------

describe("struct", function()
  local runner = makeRunner(TEST_JSON_FILE, sdk.test(nil, nil))

  local runnerStruct = runner('struct')
  local spec, runset, runsetflags, client = runnerStruct.spec,
      runnerStruct.runset, runnerStruct.runsetflags, runnerStruct.client

  local struct_util = client.utility().struct
  -- Extract test specifications for different function groups
  local clone = struct_util.clone
  local delprop = struct_util.delprop
  local escre = struct_util.escre
  local escurl = struct_util.escurl
  local filter = struct_util.filter
  local flatten = struct_util.flatten
  local getelem = struct_util.getelem
  local getpath = struct_util.getpath
  local getprop = struct_util.getprop

  local haskey = struct_util.haskey
  local inject = struct_util.inject
  local isempty = struct_util.isempty
  local isfunc = struct_util.isfunc
  local iskey = struct_util.iskey

  local islist = struct_util.islist
  local ismap = struct_util.ismap
  local isnode = struct_util.isnode
  local items = struct_util.items
  local join = struct_util.join
  local jsonify = struct_util.jsonify

  local keysof = struct_util.keysof
  local merge = struct_util.merge
  local pad = struct_util.pad
  local pathify = struct_util.pathify
  local select_fn = struct_util.select
  local setpath = struct_util.setpath
  local setprop = struct_util.setprop
  local size = struct_util.size
  local slice = struct_util.slice
  local strkey = struct_util.strkey

  local stringify = struct_util.stringify
  local transform = struct_util.transform
  local typename = struct_util.typename
  local typify = struct_util.typify
  local validate = struct_util.validate
  local walk = struct_util.walk

  local minorSpec = spec.minor
  local walkSpec = spec.walk
  local mergeSpec = spec.merge
  local getpathSpec = spec.getpath
  local injectSpec = spec.inject
  local transformSpec = spec.transform
  local validateSpec = spec.validate
  local selectSpec = spec.select

  -- Basic existence tests
  test("exists", function()
    assert.equal("function", type(clone))
    assert.equal("function", type(delprop))
    assert.equal("function", type(escre))
    assert.equal("function", type(escurl))
    assert.equal("function", type(filter))

    assert.equal("function", type(flatten))
    assert.equal("function", type(getelem))
    assert.equal("function", type(getprop))
    assert.equal("function", type(getpath))

    assert.equal("function", type(haskey))
    assert.equal("function", type(inject))
    assert.equal("function", type(isempty))
    assert.equal("function", type(isfunc))

    assert.equal("function", type(iskey))
    assert.equal("function", type(islist))
    assert.equal("function", type(ismap))
    assert.equal("function", type(isnode))
    assert.equal("function", type(items))

    assert.equal("function", type(join))
    assert.equal("function", type(jsonify))
    assert.equal("function", type(keysof))
    assert.equal("function", type(merge))
    assert.equal("function", type(pad))
    assert.equal("function", type(pathify))

    assert.equal("function", type(select_fn))
    assert.equal("function", type(setpath))
    assert.equal("function", type(size))
    assert.equal("function", type(slice))
    assert.equal("function", type(setprop))

    assert.equal("function", type(strkey))
    assert.equal("function", type(stringify))
    assert.equal("function", type(transform))
    assert.equal("function", type(typename))
    assert.equal("function", type(typify))
    assert.equal("function", type(validate))
    assert.equal("function", type(walk))
  end)


  -- STRUCT NULLSEM, deliberately NOT a lane here (ts/js/go/py carry one).
  --
  -- The struct.nullsem section asks whether a PRESENT key holding a JSON
  -- null reads as "no value". Lua cannot EXPRESS a stored null at all: a
  -- lua table cannot hold nil, so `{a = nil}` IS `{}` and `[10, null,
  -- 30]` has no representation (the runner boundary rewrites list nulls
  -- to the string "null", which answers the WRONG way on the corpus's
  -- getelem lanes). Measured against the vendored struct: getprop /
  -- getelem / getpath / haskey / keysof over a "stored null" all answer
  -- as ABSENT, vacuously - the null was never stored. A lane would
  -- assert nothing about null semantics, so it is skipped OUT LOUD
  -- instead of passing vacuously.
  pending("nullsem: lua cannot express a stored JSON null - see comment")


  ----------------------------------------------------------
  -- Minor Tests
  ----------------------------------------------------------

  test("minor-isnode", function()
    runset(minorSpec.isnode, isnode)
  end)


  test("minor-ismap", function()
    runset(minorSpec.ismap, ismap)
  end)


  test("minor-islist", function()
    runset(minorSpec.islist, islist)
  end)


  test("minor-iskey", function()
    runsetflags(minorSpec.iskey, {
      null = false
    }, iskey)
  end)


  test("minor-strkey", function()
    runsetflags(minorSpec.strkey, {
      null = false
    }, strkey)
  end)


  test("minor-isempty", function()
    runsetflags(minorSpec.isempty, {
      null = false
    }, isempty)
  end)


  test("minor-isfunc", function()
    runset(minorSpec.isfunc, isfunc)
  end)


  test("minor-clone", function()
    runsetflags(
      dropentries(minorSpec.clone, {
        -- `clone(null)`, which must give back null. The port returns nil,
        -- read as absent. (`clone()` with NO argument passes - NOVAL.)
        { at = 5, why = "clone(null)", is = function(entry)
          return isnull(entry["in"]) and isnull(entry.out)
        end },
      }),
      {
        null = false
      },
      clone
    )

    -- Additional function cloning test
    local f0 = function()
      return nil
    end

    local original = {
      a = f0,
    }
    local copied = clone(original)
    assert.are.same(original, copied)
  end)


  test("minor-filter", function()
    local checkmap = {
      gt3 = function(n)
        return n[2] > 3
      end,
      lt3 = function(n)
        return n[2] < 3
      end,
    }
    runset(minorSpec.filter, function(vin)
      return filter(vin.val, checkmap[vin.check])
    end)
  end)


  test("minor-flatten", function()
    runset(minorSpec.flatten, function(vin)
      return flatten(vin.val, vin.depth)
    end)
  end)


  test("minor-escre", function()
    runset(minorSpec.escre, escre)
  end)


  test("minor-escurl", function()
    runset(minorSpec.escurl, escurl)
  end)


  test("minor-stringify", function()
    -- null = true so a JSON null `val` arrives as NULLMARK;
    -- stringify(NULLMARK) is "null" (canonical TS stringify(null) ===
    -- "null"), while an absent val (nil) is "".
    runsetflags(minorSpec.stringify, {
      null = true
    }, function(vin)
      return stringify(vin.val, vin.max)
    end)
  end)


  test("minor-pathify", function()
    -- null = true so a JSON null path arrives as NULLMARK. pathify treats
    -- NULLMARK as a scalar (not a key), so null path elements are dropped
    -- via iskey and a top-level null renders as <unknown-path:null>.
    runsetflags(minorSpec.pathify, {
      null = true
    }, function(vin)
      return pathify(vin.path, vin.from)
    end)
  end)


  test("minor-items", function()
    runset(minorSpec.items, items)
  end)


  test("minor-edge-items", function()
    local a0 = {11, 22, 33}
    a0.x = 1
    assert.same(items(a0), {{'0', 11}, {'1', 22}, {'2', 33}})
  end)


  test("minor-getprop", function()
    runsetflags(
      dropentries(minorSpec.getprop, {
        -- A null `alt`, which getprop must hand straight back. The port
        -- receives it as nil and returns nil, read as absent. The other
        -- entries - every missing-key case among them - pass.
        { at = 50, why = "getprop with a null alt", is = function(entry)
          return "x" == entryin(entry, "key") and isnull(entryin(entry, "alt"))
        end },
        { at = 51, why = "getprop with a null key and a null alt", is = function(entry)
          return isnull(entryin(entry, "key")) and isnull(entryin(entry, "alt"))
        end },
      }),
      {
      null = false
    }, function(vin)
      if vin.alt == nil then
        return getprop(vin.val, vin.key)
      else
        return getprop(vin.val, vin.key, vin.alt)
      end
    end)
  end)


  test("minor-edge-getprop", function()
    local strarr = { "a", "b", "c", "d", "e" }
    assert.same(getprop(strarr, 2), "c")
    assert.same(getprop(strarr, "2"), "c")

    local intarr = { 2, 3, 5, 7, 11 }
    assert.same(getprop(intarr, 2), 5)
    assert.same(getprop(intarr, "2"), 5)
  end)


  test("minor-setprop", function()
    runset(minorSpec.setprop, function(vin)
      return setprop(vin.parent, vin.key, vin.val)
    end)
  end)


  test("minor-edge-setprop", function()
    local strarr0 = { "a", "b", "c", "d", "e" }
    local strarr1 = { "a", "b", "c", "d", "e" }
    assert.same({ "a", "b", "C", "d", "e" }, setprop(strarr0, 2, "C"))
    assert.same({ "a", "b", "CC", "d", "e" }, setprop(strarr1, "2", "CC"))

    local intarr0 = { 2, 3, 5, 7, 11 }
    local intarr1 = { 2, 3, 5, 7, 11 }
    assert.same({ 2, 3, 55, 7, 11 }, setprop(intarr0, 2, 55))
    assert.same({ 2, 3, 555, 7, 11 }, setprop(intarr1, "2", 555))
  end)


  test("minor-haskey", function()
    runsetflags(minorSpec.haskey, {
      null = false
    }, function(vin)
      return haskey(vin.src, vin.key)
    end)
  end)


  test("minor-keysof", function()
    runset(minorSpec.keysof, keysof)
  end)

  test("minor-edge-keysof", function()
    local a0 = {11, 22, 33}
    a0.x = 1
    assert.same(keysof(a0), {'0', '1', '2'})
  end)


  test("minor-join", function()
    runsetflags(minorSpec.join, {
      null = false
    }, function(vin)
      return join(vin.val, vin.sep, vin.url)
    end)
  end)


  test("minor-typename", function()
    runset(minorSpec.typename, typename)
  end)


  test("minor-typify", function()
    -- null = false so a JSON null `in` arrives as nil; typify(nil) is
    -- T_scalar|T_null, matching canonical TS typify(null). The
    -- typify(undefined)==T_noval entry has no `in` and reaches the
    -- subject as NOVAL (resolver decision 4), answering T_noval.
    runsetflags(minorSpec.typify, {
      null = false
    }, typify)
  end)


  test("minor-getelem", function()
    runsetflags(minorSpec.getelem, {
      null = false
    }, function(vin)
      if vin.alt == nil then
        return getelem(vin.val, vin.key)
      else
        return getelem(vin.val, vin.key, vin.alt)
      end
    end)
  end)


  test("minor-size", function()
    runsetflags(minorSpec.size, {
      null = false
    }, size)
  end)


  test("minor-slice", function()
    runsetflags(minorSpec.slice, {
      null = false
    }, function(vin)
      return slice(vin.val, vin.start, vin['end'])
    end)
  end)


  test("minor-pad", function()
    runsetflags(minorSpec.pad, {
      null = false
    }, function(vin)
      return pad(vin.val, vin.pad, vin.char)
    end)
  end)


  test("minor-setpath", function()
    runsetflags(minorSpec.setpath, {
      null = false
    }, function(vin)
      return setpath(vin.store, vin.path, vin.val)
    end)
  end)


  test("minor-delprop", function()
    runset(minorSpec.delprop, function(vin)
      return delprop(vin.parent, vin.key)
    end)
  end)


  test("minor-edge-delprop", function()
    local strarr0 = { "a", "b", "c", "d", "e" }
    local strarr1 = { "a", "b", "c", "d", "e" }
    assert.same({ "a", "b", "d", "e" }, delprop(strarr0, 2))
    assert.same({ "a", "b", "d", "e" }, delprop(strarr1, "2"))

    local intarr0 = { 2, 3, 5, 7, 11 }
    local intarr1 = { 2, 3, 5, 7, 11 }
    assert.same({ 2, 3, 7, 11 }, delprop(intarr0, 2))
    assert.same({ 2, 3, 7, 11 }, delprop(intarr1, "2"))
  end)


  test("minor-jsonify", function()
    runsetflags(minorSpec.jsonify, {
      null = false
    }, function(vin)
      return jsonify(vin.val, vin.flags)
    end)
  end)


  ----------------------------------------------------------
  -- Walk Tests
  ----------------------------------------------------------

  test("walk-log", function()
    local walktest = tostructval(walkSpec.log)

    local function walklog(key, val, parent, path)
      return "k=" .. stringify(key) .. ", v=" .. stringify(val) .. ", p=" ..
        stringify(parent) .. ", t=" .. pathify(path)
    end

    -- Test before callback
    local logb = array()
    local function walklog_before(key, val, parent, path)
      table.insert(logb, walklog(key, val, parent, path))
      return val
    end
    walk(walktest["in"], walklog_before)
    assert.same(logb, walktest.out.before)

    -- Test after callback
    local loga = array()
    local function walklog_after(key, val, parent, path)
      table.insert(loga, walklog(key, val, parent, path))
      return val
    end
    walk(walktest["in"], nil, walklog_after)
    assert.same(loga, walktest.out.after)

    -- Test both callbacks
    local logba = array()
    local function walklog_both(key, val, parent, path)
      table.insert(logba, walklog(key, val, parent, path))
      return val
    end
    walk(walktest["in"], walklog_both, walklog_both)
    assert.same(logba, walktest.out.both)
  end)


  test("walk-basic", function()
    local function walkpath(_key, val, _parent, path)
      if type(val) == "string" then
        return val .. "~" .. table.concat(path, ".")
      else
        return val
      end
    end
    runset(walkSpec.basic, function(vin)
      return walk(vin, walkpath)
    end)
  end)


  test("walk-depth", function()
    runsetflags(walkSpec.depth, { null = false }, function(vin)
      local top = nil
      local cur = nil
      local function copy(key, val, _parent, _path)
        if key == nil or isnode(val) then
          local child = islist(val) and array() or object()
          if key == nil then
            top = child
            cur = child
          else
            cur[key] = child
            cur = child
          end
        else
          cur[key] = val
        end
        return val
      end
      walk(vin.src, copy, nil, vin.maxdepth)
      return top
    end)
  end)


  test("walk-copy", function()
    local cur

    local function walkcopy(key, val, _parent, path)
      if key == nil then
        cur = {}
        cur[0] = ismap(val) and object() or islist(val) and array() or val
        return val
      end

      local v = val
      local i = size(path)

      if isnode(v) then
        v = ismap(v) and object() or array()
        cur[i] = v
      end

      setprop(cur[i - 1], key, v)

      return val
    end

    runset(walkSpec.copy, function(vin)
      walk(vin, walkcopy)
      return cur[0]
    end)
  end)


  ----------------------------------------------------------
  -- Merge Tests
  ----------------------------------------------------------

  test("merge-basic", function()
    local mergetest = tostructval(mergeSpec.basic)
    assert.same(mergetest.out, merge(mergetest['in']))
  end)


  test("merge-cases", function()
    runset(mergeSpec.cases, merge)
  end)


  test("merge-array", function()
    runset(mergeSpec.array, merge)
  end)


  test("merge-integrity", function()
    runset(mergeSpec.integrity, merge)
  end)


  test("merge-special", function()
    local f0 = function()
      return nil
    end

    assert.same(f0, merge(array(f0)))
    assert.same(f0, merge(array(nil, f0)))
    assert.same(object({
      a = f0
    }), merge(array(object({
      a = f0
    }))))
    assert.same(object({
      a = object({
        b = f0
      })
    }), merge(array(object({
      a = object({
        b = f0
      })
    }))))
  end)


  test("merge-depth", function()
    runset(mergeSpec.depth, function(vin)
      return merge(vin.val, vin.depth)
    end)
  end)


  ----------------------------------------------------------
  -- GetPath Tests
  ----------------------------------------------------------

  test("getpath-basic", function()
    runset(getpathSpec.basic, function(vin)
      return getpath(vin.store, vin.path)
    end)
  end)


  test("getpath-relative", function()
    runset(getpathSpec.relative, function(vin)
      local dpath = vin.dpath
      if type(dpath) == 'string' then
        -- Split dpath string into array
        local parts = {}
        for part in dpath:gmatch('[^%.]+') do
          table.insert(parts, part)
        end
        dpath = parts
      end
      return getpath(vin.store, vin.path, { dparent = vin.dparent, dpath = dpath })
    end)
  end)


  test("getpath-special", function()
    runset(spec.getpath.special, function(vin)
      return getpath(vin.store, vin.path, vin.inj)
    end)
  end)


  test("getpath-handler", function()
    runset(spec.getpath.handler, function(vin)
      return getpath(
        {
          ["$TOP"] = vin.store,
          ["$FOO"] = function() return 'foo' end,
        },
        vin.path,
        {
          handler = function(_inj, val, _cur, _ref)
            return val()
          end
        }
      )
    end)
  end)


  ----------------------------------------------------------
  -- Inject Tests
  ----------------------------------------------------------

  test("inject-basic", function()
    local injecttest = tostructval(injectSpec.basic)
    assert.same(injecttest.out, inject(injecttest['in'].val, injecttest['in'].store))
  end)


  test("inject-string", function()
    runset(injectSpec.string, function(vin)
      local result = inject(vin.val, vin.store, { modify = nullModifier })
      return result
    end)
  end)


  test("inject-deep", function()
    runset(injectSpec.deep, function(vin)
      return inject(vin.val, vin.store)
    end)
  end)


  ----------------------------------------------------------
  -- Transform Tests
  ----------------------------------------------------------

  test("transform-basic", function()
    local transformtest = tostructval(transformSpec.basic)
    assert.same(transform(transformtest['in'].data, transformtest['in'].spec),
      transformtest.out)
  end)


  test("transform-paths", function()
    runset(transformSpec.paths, function(vin)
      return transform(vin.data, vin.spec)
    end)
  end)


  test("transform-cmds", function()
    runset(transformSpec.cmds, function(vin)
      return transform(vin.data, vin.spec)
    end)
  end)


  test("transform-each", function()
    runset(transformSpec.each, function(vin)
      return transform(vin.data, vin.spec)
    end)
  end)


  test("transform-pack", function()
    runset(transformSpec.pack, function(vin)
      return transform(vin.data, vin.spec)
    end)
  end)


  test("transform-ref", function()
    runset(transformSpec.ref, function(vin)
      return transform(vin.data, vin.spec)
    end)
  end)


  test("transform-format", function()
    runsetflags(transformSpec.format, { null = false }, function(vin)
      return transform(vin.data, vin.spec)
    end)
  end)


  test("transform-apply", function()
    runset(transformSpec.apply, function(vin)
      return transform(vin.data, vin.spec)
    end)
  end)


  test("transform-modify", function()
    runset(transformSpec.modify, function(vin)
      return transform(vin.data, vin.spec, {
        modify = function(val, key, parent)
          -- Modify string values by adding '@' prefix
          if key ~= nil and parent ~= nil and type(val) == "string" then
            parent[key] = "@" .. val
          end
        end
      })
    end)
  end)


  test("transform-extra", function()
    -- Test advanced transform functionality
    assert.same(transform({
      a = 1
    }, {
      x = '`a`',
      b = '`$COPY`',
      c = '`$UPPER`'
    }, {
      extra = {
        b = 2,
        ["$UPPER"] = function(inj)
          local path = inj.path
          return ('' .. tostring(getprop(path, #path - 1))):upper()
        end
      }
    }), {
      x = 1,
      b = 2,
      c = 'C'
    })
  end)


  test("transform-funcval", function()
    -- Test function handling in transform
    local f0 = function()
      return 99
    end

    assert.same(transform({}, {
      x = 1
    }), {
      x = 1
    })
    assert.same(transform({}, {
      x = f0
    }), {
      x = f0
    })
    assert.same(transform({
      a = 1
    }, {
      x = '`a`'
    }), {
      x = 1
    })
    assert.same(transform({
      f0 = f0
    }, {
      x = '`f0`'
    }), {
      x = f0
    })
  end)


  ----------------------------------------------------------
  -- Validate Tests
  ----------------------------------------------------------

  test("validate-basic", function()
    runsetflags(
      dropentries(validateSpec.basic, {
        -- `$NULL` against null data: validate returns the null, the port
        -- returns nil, read as absent. (`$NULL` against non-null data at
        -- a later index still runs - the error path needs no stored
        -- null.)
        { at = 13, why = "$NULL validating null data", is = function(entry)
          return "`$NULL`" == entryin(entry, "spec") and isnull(entryin(entry, "data"))
        end },
      }),
      { null = false },
      function(vin)
        return validate(vin.data, vin.spec)
      end
    )
  end)


  test("validate-child", function()
    runset(validateSpec.child, function(vin)
      return validate(vin.data, vin.spec)
    end)
  end)


  test("validate-one", function()
    runset(validateSpec.one, function(vin)
      return validate(vin.data, vin.spec)
    end)
  end)


  test("validate-exact", function()
    runset(validateSpec.exact, function(vin)
      return validate(vin.data, vin.spec)
    end)
  end)


  test("validate-invalid", function()
    runsetflags(validateSpec.invalid, { null = false }, function(vin)
      return validate(vin.data, vin.spec)
    end)
  end)


  test("validate-special", function()
    runset(validateSpec.special, function(vin)
      return validate(vin.data, vin.spec, vin.inj)
    end)
  end)


  test("validate-custom", function()
    -- Test custom validation functions
    local errs = array()
    local extra = {
      ["$INTEGER"] = function(inj)
        local key = inj.key
        local out = getprop(inj.dparent, key)

        local t = type(out)
        -- Verify the value is an integer
        if (t ~= "number") and (math.type(out) ~= "integer") then
          -- Build path string from inj.path elements, starting at index 2
          local path_parts = {}
          for i = 2, #inj.path do
            table.insert(path_parts, tostring(inj.path[i]))
          end
          local path_str = table.concat(path_parts, ".")
          table.insert(inj.errs, "Not an integer at " .. path_str .. ": " ..
            tostring(out))
          return nil
        end
        return out
      end
    }

    local shape = {
      a = "`$INTEGER`"
    }

    local out = validate({
      a = 1
    }, shape, { extra = extra, errs = errs })
    assert.same({
      a = 1
    }, out)
    assert.equal(0, #errs)

    out = validate({ a = "A" }, shape, { extra = extra, errs = errs })
    assert.same({ a = "A" }, out)
    assert.same(array("Not an integer at a: A"), errs)
  end)


  ----------------------------------------------------------
  -- Select Tests
  ----------------------------------------------------------

  test("select-basic", function()
    runset(selectSpec.basic, function(vin)
      return select_fn(vin.obj, vin.query)
    end)
  end)


  test("select-operators", function()
    runset(selectSpec.operators, function(vin)
      return select_fn(vin.obj, vin.query)
    end)
  end)


  test("select-edge", function()
    runset(selectSpec.edge, function(vin)
      return select_fn(vin.obj, vin.query)
    end)
  end)


  test("select-alts", function()
    runset(selectSpec.alts, function(vin)
      return select_fn(vin.obj, vin.query)
    end)
  end)
end)

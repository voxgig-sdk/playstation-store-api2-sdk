-- VENDORED: @voxgig/omni sdk-20260908-1556-0 (lua/src/runner.lua)
-- Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
-- License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
-- Omni: the shared multi-language test runner (Lua port).
--
-- Port of the canonical TypeScript implementation
-- (typescript/src/Runner.ts). Behaviour must match, case for case.

-- Sibling modules are required RELATIVE to this one, so omni's `src/` never
-- has to be on a consumer's package.path. omni's own harness requires bare
-- names (`require('util')`) and gets an empty prefix; the struct compat shim
-- requires `src.util` and gets `src.`, which then finds `src.json`.
--
-- A bare `require('json')` here would force a consumer to add omni's `src/`
-- to package.path -- and that shadows the consumer's OWN modules of the same
-- name. It bit exactly that way: omni ships `src/regex.lua`, struct/lua ships
-- `src/regex.lua`, and struct's regex silently became omni's.
local _prefix = (...):match('^(.*%.)[^.]*$') or ''

local regex = require(_prefix .. 'regex')
local u = require(_prefix .. 'util')

local M = {}

M.NULLMARK = u.NULLMARK
M.UNDEFMARK = u.UNDEFMARK
M.EXISTSMARK = u.EXISTSMARK
M.NULL = u.NULL
M.ABSENT = u.ABSENT

-- The newest spec format version this runner understands. A spec with no
-- OMNI block is version 0: the original, lenient format, frozen forever.
-- Version 1 turns on strict entry validation (see checkentry).
M.SPECVERSION = 1

-- Capability strings this runner supports beyond the version baseline. A
-- spec's OMNI.requires list is checked against this: an unknown capability
-- refuses the spec loudly at load time, instead of a lagging port silently
-- mis-running it. (Empty today; future format features mint a string here.)
M.CAPABILITIES = {}

-- The complete set of fields an entry may carry. Under version 1 anything
-- else is an error: an unrecognised key is almost always a typo'd
-- assertion, and a typo'd assertion is a test that silently stopped
-- testing.
local ENTRYFIELDS = { 'in', 'args', 'ctx', 'out', 'err', 'match', 'client', 'id', 'doc' }

-- Linear membership check (Lua has no Array#includes).
local function contains(list, value)
  for _, item in ipairs(list) do
    if item == value then
      return true
    end
  end
  return false
end

-- A test failure (or a malformed spec). Raised as a table, so that errors
-- raised by the subject under test (plain strings) stay distinguishable.
local OMNIMT = { __tostring = function(err) return err.message end }

function M.OmniError(message, entry)
  return setmetatable({ omni = true, message = message, entry = entry }, OMNIMT)
end

function M.isomnierror(err)
  return 'table' == type(err) and true == err.omni
end

--- The message an `err` expectation matches.
function M.errmessage(err)
  if M.isomnierror(err) then
    return err.message
  end
  if 'table' == type(err) and nil ~= err.message then
    return tostring(err.message)
  end
  return tostring(err)
end

--- Load a spec: a path to a JSON file.
function M.loadspec(path)
  local handle = io.open(path, 'r')
  if nil == handle then
    error(M.OmniError('omni: cannot read spec: ' .. path))
  end

  local text = handle:read('a')
  handle:close()

  return u.parse(text)
end

--- Find `primary.<name>`, then `<name>`, then the whole spec.
function M.resolvespec(name, alltests)
  if nil == name or '' == name then
    return alltests
  end

  local primary = u.get(u.get(alltests, 'primary'), name)
  if not u.isabsent(primary) then
    return primary
  end

  local section = u.get(alltests, name)
  if not u.isabsent(section) then
    return section
  end

  return alltests
end

-- Read the spec's format version from its optional top-level OMNI block,
-- and refuse a spec this runner cannot faithfully run: a version newer
-- than SPECVERSION, or a required capability not in CAPABILITIES.
local function resolveversion(alltests)
  local meta = u.ABSENT
  if u.ismap(alltests) then
    meta = u.get(alltests, 'OMNI')
  end

  if u.isabsent(meta) then
    return 0
  end

  local version = u.ABSENT
  if u.ismap(meta) then
    version = u.get(meta, 'version')
  end

  if not u.ismap(meta) or not u.isnum(version) or 0 ~= (version % 1) then
    error(M.OmniError('omni: malformed OMNI version block'))
  end

  if 0 > version or M.SPECVERSION < version then
    error(M.OmniError('omni: unsupported spec version: ' .. u.stringify(version)))
  end

  local requires = u.get(meta, 'requires')
  if not u.isabsent(requires) then
    if not u.islist(requires) then
      error(M.OmniError('omni: malformed OMNI requires list'))
    end
    for _, cap in ipairs(requires) do
      if not u.isstr(cap) or not contains(M.CAPABILITIES, cap) then
        error(M.OmniError('omni: spec requires unsupported capability: ' .. u.stringify(cap)))
      end
    end
  end

  return version
end

--- Nulls (and absent values) become NULLMARK. Always a fresh copy.
function M.fixjson(val, donull)
  if u.isnone(val) then
    if donull then
      return u.NULLMARK
    end
    -- Canonical returns the value UNCHANGED here (Runner.ts: `return donull ?
    -- NULLMARK : val`), which keeps undefined distinct from null. Returning
    -- u.NULL instead asserted "this is a JSON null" about an ABSENT value, so
    -- a subject that returned nothing could never match an entry with no
    -- `out`: deepequal requires both sides absent, and NULL is not absent.
    -- A raw Lua nil normalises to ABSENT because a nil cannot sit in a table.
    if nil == val then
      return u.ABSENT
    end
    return val
  end

  if u.islist(val) then
    local out = u.list({})
    for index, entry in ipairs(val) do
      out[index] = M.fixjson(entry, donull)
    end
    return out
  end

  if u.ismap(val) then
    local out = u.map({})
    for key, entry in pairs(val) do
      rawset(out, key, M.fixjson(entry, donull))
    end
    return out
  end

  return val
end

--- The JSON form of an error: always at least {name,message}.
function M.errify(err)
  return u.map({ name = 'Error', message = M.errmessage(err) })
end

--- The error base a `match.err` sees: the provider's own, when it has one.
-- A library whose errors carry a `code` reaches `match: {err: {code}}`
-- through `Provider.errify`, which REPLACES `errify` rather than adding
-- to it.
function M.errbase(err, provider)
  local hook = nil ~= provider and provider.errify or nil
  if nil ~= hook then
    return hook(err)
  end
  return M.errify(err)
end

--- Match one leaf: /regex/ or case-insensitive substring for strings.
function M.matchval(check, base)
  if u.deepequal(check, base) then
    return true
  end

  local want = check

  if u.isnone(want) then
    return u.isnone(base) or u.NULLMARK == base
  end

  if u.isstr(want) then
    -- An empty want would substring-match anything: reject it.
    if '' == want then
      return false
    end

    local basestr = u.stringify(base)

    if 2 < #want and '/' == want:sub(1, 1) and '/' == want:sub(-1) then
      return regex.find(want:sub(2, #want - 1), basestr)
    end

    return nil ~= basestr:lower():find(want:lower(), 1, true)
  end

  return u.deepequal(want, base)
end

--- Convert NULLMARK sentinels back into real nulls.
function M.nullmodifier(val)
  if u.NULLMARK == val then
    return u.NULL
  end
  if u.isstr(val) then
    return (val:gsub(u.NULLMARK, 'null'))
  end
  return val
end

-- The spec-defined part of an entry (drop runner bookkeeping).
local function entrysummary(entry)
  if not u.ismap(entry) then
    return entry
  end
  local out = u.map({})
  for key, value in pairs(entry) do
    if 'res' ~= key and 'thrown' ~= key and 'ctx' ~= key then
      rawset(out, key, value)
    end
  end
  return out
end

-- The label of one entry, for failure messages.
local function entryref(label, index, entry)
  local id = u.get(entry, 'id')
  local idpart = u.isabsent(id) and '' or (' (' .. u.stringify(id) .. ')')
  return label .. '[' .. index .. ']' .. idpart
end

local function fail(label, index, entry, reason, expected, actual)
  local msg = 'omni: ' .. entryref(label, index, entry) .. ': ' .. reason

  if nil ~= expected then
    msg = msg .. '\n  expected: ' .. expected
  end
  if nil ~= actual then
    msg = msg .. '\n  actual:   ' .. actual
  end

  msg = msg .. '\n  entry:    ' .. u.stringify(entrysummary(entry))

  return M.OmniError(msg, entry)
end

-- Strict entry validation, applied when the spec declares version 1 or
-- later. The lenient format converts each of these mistakes into a silent
-- pass or a dead field; here they fail with the entry named.
local function checkentry(label, index, entry)
  if not u.ismap(entry) then
    error(fail(label, index, entry, 'entry is not a map'))
  end

  for key in pairs(entry) do
    if not contains(ENTRYFIELDS, key) then
      error(fail(label, index, entry, 'unknown entry field: ' .. key))
    end
  end

  local argsources = 0
  for _, key in ipairs({ 'in', 'args', 'ctx' }) do
    if u.has(entry, key) then
      argsources = argsources + 1
    end
  end
  if 1 < argsources then
    error(fail(label, index, entry, 'entry has more than one of in, args, ctx'))
  end

  if not u.isnone(u.get(entry, 'err')) and u.has(entry, 'out') then
    error(fail(label, index, entry, 'entry has both err and out'))
  end

  if u.has(entry, 'id') and not u.isstr(u.get(entry, 'id')) then
    error(fail(label, index, entry, 'entry id is not a string'))
  end
end

-- Validate a version-1 group up front, against the AUTHORED entries -
-- null-normalisation would otherwise rewrite an authored null (e.g.
-- id: null) into a sentinel string and hide it from validation. A
-- malformed spec is a spec error, not a test result, so it fails before
-- any subject runs.
local function checkset(label, testspec, normalset)
  local origset = normalset
  if u.ismap(testspec) and u.islist(u.get(testspec, 'set')) then
    origset = u.get(testspec, 'set')
  end

  local empty = u.ABSENT
  if u.ismap(testspec) then
    empty = u.get(testspec, 'empty')
  end

  if 0 == #origset and true ~= empty then
    error(M.OmniError('omni: empty test set: ' .. label))
  end

  for at, entry in ipairs(origset) do
    checkentry(label, at - 1, entry)
  end
end

-- Check that every leaf of `check` is present, and matches, in `base`.
local function matchcheck(label, index, entry, check, base, path)
  path = path or {}

  local where = 0 == #path and '<root>' or u.pathify(path)

  if u.islist(check) then
    for at, subcheck in ipairs(check) do
      local childpath = { table.unpack(path) }
      childpath[#childpath + 1] = tostring(at - 1)
      matchcheck(label, index, entry, subcheck, base, childpath)
    end
    return
  end

  if u.ismap(check) then
    for key, subcheck in pairs(check) do
      local childpath = { table.unpack(path) }
      childpath[#childpath + 1] = key
      matchcheck(label, index, entry, subcheck, base, childpath)
    end
    return
  end

  local baseval = u.getpath(base, path)

  -- The sentinels are tested BEFORE the identity check below. Otherwise a
  -- subject returning the literal string "__UNDEF__" satisfies an assertion
  -- that the key is absent - two mutually exclusive states passing one
  -- check. A sentinel that accepts its own literal is not a sentinel.
  -- (NULLMARK still accepts NULLMARK: under the default null flag a real
  -- null has already been normalised to it, so the two are genuinely
  -- indistinguishable here - that one needs a raw-value escape, not an
  -- ordering change.)

  -- Explicitly absent: satisfied only by a genuinely missing key, never by
  -- a present null (the distinction the sentinels exist to keep).
  if u.UNDEFMARK == check then
    if u.isabsent(baseval) then
      return
    end
    error(fail(label, index, entry, 'expected absent at ' .. where,
      'absent', u.stringify(baseval)))
  end

  -- Explicitly null: satisfied only by a present null.
  if u.NULLMARK == check then
    if u.isnull(baseval) or u.NULLMARK == baseval then
      return
    end
    error(fail(label, index, entry, 'expected null at ' .. where,
      'null', u.stringify(baseval)))
  end

  -- Explicitly present: any present value, including null.
  if u.EXISTSMARK == check then
    if not u.isabsent(baseval) then
      return
    end
    error(fail(label, index, entry, 'expected present at ' .. where,
      'present', 'absent'))
  end

  -- Identical values match. This sits below the sentinel branches on
  -- purpose - see the note above.
  if u.deepequal(check, baseval) then
    return
  end

  -- A concrete expectation never matches a missing key - a match leaf
  -- against an absent value must fail, not substring-match "undefined".
  if u.isabsent(baseval) then
    error(fail(label, index, entry, 'match failed at ' .. where,
      u.stringify(check), 'absent'))
  end

  if not M.matchval(check, baseval) then
    error(fail(label, index, entry, 'match failed at ' .. where,
      u.stringify(check), u.stringify(baseval)))
  end
end

M.match = matchcheck

local function checkresult(label, index, entry, args, res)
  local matched = false

  local entryerr = u.get(entry, 'err')
  if not u.isnone(entryerr) then
    error(fail(label, index, entry, 'expected error did not occur',
      u.stringify(entryerr), u.stringify(res)))
  end

  local check = u.get(entry, 'match')
  if not u.isnone(check) then
    local base = u.map({
      ['in'] = u.get(entry, 'in'),
      args = u.list(args),
      out = u.get(entry, 'res'),
      ctx = u.get(entry, 'ctx'),
    })
    matchcheck(label, index, entry, check, base)
    matched = true
  end

  local out = u.get(entry, 'out')

  if u.deepequal(res, out) then
    return
  end

  -- NOTE: a match with no explicit out is a complete check on its own.
  if matched and (u.isnone(out) or u.NULLMARK == out) then
    return
  end

  error(fail(label, index, entry, 'result mismatch', u.stringify(out), u.stringify(res)))
end

local function handleerror(label, index, entry, err, provider)
  local entryerr = u.get(entry, 'err')

  if not u.isnone(entryerr) then
    if true == entryerr or M.matchval(entryerr, M.errmessage(err)) then
      local check = u.get(entry, 'match')
      if not u.isnone(check) then
        local base = u.map({
          ['in'] = u.get(entry, 'in'),
          out = u.get(entry, 'res'),
          ctx = u.get(entry, 'ctx'),
          err = M.errbase(err, provider),
        })
        matchcheck(label, index, entry, check, base)
      end
      return
    end

    error(fail(label, index, entry, 'error mismatch',
      u.stringify(entryerr), M.errmessage(err)))
  end

  error(fail(label, index, entry, 'unexpected error', nil, M.errmessage(err)))
end

-- Build the argument list: `ctx`, `args`, or `in`. `client` is the
-- provider that owns this entry's subject (the root provider, unless
-- `entry.client` names a DEF.client override) - the runner attaches it to
-- a contextified map argument, so a subject can reach the provider that
-- owns it.
local function resolveargs(entry, client, provider)
  local args

  local hasctx = u.has(entry, 'ctx')
  local hasargs = u.has(entry, 'args')

  if hasctx then
    args = { u.get(entry, 'ctx') }
  elseif hasargs then
    local raw = u.get(entry, 'args')
    args = {}
    for index, value in ipairs(raw) do
      args[index] = value
    end
  else
    args = { u.clone(u.get(entry, 'in')) }
  end

  if (hasctx or hasargs) and u.ismap(args[1]) then
    local first = u.clone(args[1])
    if nil ~= provider.contextify then
      first = provider.contextify(first)
    end
    args[1] = first
    rawset(entry, 'ctx', first)
    if u.ismap(first) then
      rawset(first, 'client', client)
    end
  end

  return args
end

--- Make a runner for a spec file path (or spec value) and a provider.
function M.makeRunner(specref, provider)
  local alltests = u.isstr(specref) and M.loadspec(specref) or specref
  local specversion = resolveversion(alltests)
  local useprovider = provider or {}

  return function(name, store)
    local spec = M.resolvespec(name, alltests)
    local clients = {}

    local defclient = u.get(u.get(spec, 'DEF'), 'client')

    -- A spec may define clients that a given test run never references.
    if u.ismap(defclient) and nil ~= useprovider.client then
      for clientname, cdef in pairs(defclient) do
        local copts = u.get(u.get(cdef, 'test'), 'options')
        if u.isabsent(copts) then
          copts = u.map({})
        end
        if nil ~= useprovider.inject and u.ismap(store) then
          copts = useprovider.inject(copts, store)
        end
        clients[clientname] = useprovider.client(copts)
      end
    end

    local subject = nil
    if nil ~= useprovider.subject and nil ~= name then
      subject = useprovider.subject(name)
    end

    local runpack = {
      spec = spec,
      subject = subject,
      client = useprovider,
    }

    runpack.set = function(setname)
      return u.get(spec, setname)
    end

    runpack.runsetflags = function(testspec, flags, testsubject)
      flags = flags or {}
      local donull = nil == flags.null and true or (true == flags.null)
      local label = flags.name or ((nil == name or '' == name) and 'set' or name)

      local usesubject = testsubject or subject
      if nil == usesubject then
        error(M.OmniError('omni: no test subject for: ' .. label))
      end

      local testspecmap = M.fixjson(testspec, donull)
      local testset = u.get(testspecmap, 'set')

      if not u.islist(testset) then
        error(M.OmniError('omni: test spec has no set: ' .. label))
      end

      if 1 <= specversion then
        checkset(label, testspec, testset)
      end

      for at, entry in ipairs(testset) do
        local index = at - 1

        if not u.ismap(entry) then
          error(M.OmniError('omni: ' .. label .. '[' .. index .. ']: entry is not a map'))
        end

        -- An entry with no `out` expects a null (or absent) result.
        if donull and u.isnone(u.get(entry, 'out')) then
          rawset(entry, 'out', u.NULLMARK)
        end

        local entrysubject = usesubject
        local entryclient = useprovider
        local clientname = u.get(entry, 'client')

        if u.isstr(clientname) then
          local client = clients[clientname]
          if nil == client then
            error(M.OmniError('omni: unknown client: ' .. clientname, entry))
          end
          entryclient = client
          if nil ~= client.subject then
            local clientsubject = client.subject(name)
            if nil ~= clientsubject then
              entrysubject = clientsubject
            end
          end
        end

        local args = resolveargs(entry, entryclient, useprovider)

        local ok, result = pcall(entrysubject, table.unpack(args))

        if ok then
          local res = M.fixjson(result, donull)
          rawset(entry, 'res', res)
          checkresult(label, index, entry, args, res)
        elseif M.isomnierror(result) then
          error(result)
        else
          handleerror(label, index, entry, result, useprovider)
        end
      end
    end

    runpack.runset = function(testspec, testsubject)
      return runpack.runsetflags(testspec, {}, testsubject)
    end

    return runpack
  end
end

return M

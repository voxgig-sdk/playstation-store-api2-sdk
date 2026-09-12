-- VENDORED: @voxgig/omni sdk-20260908-1556-0 (lua/src/util.lua)
-- Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
-- License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
-- Omni internal JSON utilities.
--
-- Self-contained by design: the omni runner must be able to test *any*
-- library, including libraries that provide these same operations.

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

local json = require(_prefix .. 'json')

local M = {}

M.NULLMARK = '__NULL__'     -- Value is JSON null.
M.UNDEFMARK = '__UNDEF__'   -- Value is not present.
M.EXISTSMARK = '__EXISTS__' -- Value exists (not undefined).

M.NULL = json.NULL
M.ABSENT = json.ABSENT

M.map = json.map
M.list = json.list
M.ismap = json.ismap
M.islist = json.islist
M.isnode = json.isnode
M.isabsent = json.isabsent
M.isnull = json.isnull
M.isnone = json.isnone
M.isnum = json.isnum
M.isstr = json.isstr
M.get = json.get
M.has = json.has
M.parse = json.parse

--- Deep copy a JSON value.
function M.clone(val)
  if M.islist(val) then
    local out = M.list({})
    for index, entry in ipairs(val) do
      out[index] = M.clone(entry)
    end
    return out
  end

  if M.ismap(val) then
    local out = M.map({})
    for key, entry in pairs(val) do
      rawset(out, key, M.clone(entry))
    end
    return out
  end

  return val
end

--- Read a value by path. Returns ABSENT when any step is missing.
function M.getpath(val, path)
  local current = val

  for _, part in ipairs(path) do
    if M.islist(current) then
      local index = tonumber(part)
      if nil == index or 0 > index or index >= #current then
        return M.ABSENT
      end
      current = current[index + 1]
    elseif M.ismap(current) then
      local entry = rawget(current, tostring(part))
      if nil == entry then
        return M.ABSENT
      end
      current = entry
    else
      return M.ABSENT
    end
  end

  return current
end

--- Depth-first walk: children first, then the containing node.
function M.walk(val, apply, path)
  path = path or {}
  local next = val

  if M.islist(val) then
    next = M.list({})
    for index, entry in ipairs(val) do
      local childpath = { table.unpack(path) }
      childpath[#childpath + 1] = tostring(index - 1)
      next[index] = M.walk(entry, apply, childpath)
    end
  elseif M.ismap(val) then
    next = M.map({})
    for key, entry in pairs(val) do
      local childpath = { table.unpack(path) }
      childpath[#childpath + 1] = key
      rawset(next, key, M.walk(entry, apply, childpath))
    end
  end

  return apply(next, path)
end

local function mapsize(val)
  local count = 0
  for _ in pairs(val) do
    count = count + 1
  end
  return count
end

--- Deep structural equality: numbers by value, bools never numbers.
function M.deepequal(a, b)
  if a == b then
    return true
  end

  if 'boolean' == type(a) or 'boolean' == type(b) then
    return a == b
  end

  if M.isnum(a) or M.isnum(b) then
    if not (M.isnum(a) and M.isnum(b)) then
      return false
    end

    -- NaN equals NaN: deepequal is structural, not IEEE (as canonical).
    -- NaN is the only value that is not equal to itself.
    if a ~= a and b ~= b then
      return true
    end

    return a == b
  end

  if M.isabsent(a) or M.isabsent(b) then
    return M.isabsent(a) and M.isabsent(b)
  end

  if M.isnull(a) or M.isnull(b) then
    return M.isnull(a) and M.isnull(b)
  end

  if M.islist(a) or M.islist(b) then
    if not M.islist(a) or not M.islist(b) or #a ~= #b then
      return false
    end
    for index = 1, #a do
      if not M.deepequal(a[index], b[index]) then
        return false
      end
    end
    return true
  end

  if M.ismap(a) or M.ismap(b) then
    if not M.ismap(a) or not M.ismap(b) or mapsize(a) ~= mapsize(b) then
      return false
    end
    for key, entry in pairs(a) do
      if not M.deepequal(entry, rawget(b, key)) then
        return false
      end
    end
    return true
  end

  return false
end

--- Render a number the same way in every port: 5.0 prints as 5.
function M.numstr(val)
  if val ~= val or math.huge == val or -math.huge == val then
    return 'null'
  end

  if val == math.floor(val) and math.abs(val) < 9007199254740992.0 then
    return string.format('%d', val)
  end

  return (string.format('%.17g', val))
end

--- Render a string as a JSON string literal.
function M.quote(val)
  local out = { '"' }

  for index = 1, #val do
    local ch = val:sub(index, index)
    if '"' == ch then
      out[#out + 1] = '\\"'
    elseif '\\' == ch then
      out[#out + 1] = '\\\\'
    elseif '\n' == ch then
      out[#out + 1] = '\\n'
    elseif '\r' == ch then
      out[#out + 1] = '\\r'
    elseif '\t' == ch then
      out[#out + 1] = '\\t'
    elseif 0x20 > ch:byte() then
      out[#out + 1] = string.format('\\u%04x', ch:byte())
    else
      out[#out + 1] = ch
    end
  end

  out[#out + 1] = '"'
  return table.concat(out)
end

--- Compact JSON text with map keys sorted, identical in every port.
function M.jsonstr(val)
  if M.isabsent(val) then
    return 'undefined'
  end

  if M.isnull(val) then
    return 'null'
  end

  if 'boolean' == type(val) then
    return val and 'true' or 'false'
  end

  if M.isstr(val) then
    return M.quote(val)
  end

  if M.isnum(val) then
    return M.numstr(val)
  end

  if M.islist(val) then
    local parts = {}
    for index, entry in ipairs(val) do
      parts[index] = M.jsonstr(entry)
    end
    return '[' .. table.concat(parts, ',') .. ']'
  end

  if M.ismap(val) then
    local keys = {}
    for key in pairs(val) do
      keys[#keys + 1] = key
    end
    table.sort(keys)

    local parts = {}
    for index, key in ipairs(keys) do
      parts[index] = M.quote(key) .. ':' .. M.jsonstr(rawget(val, key))
    end
    return '{' .. table.concat(parts, ',') .. '}'
  end

  return M.quote(tostring(val))
end

--- Strings verbatim, everything else as compact JSON.
function M.stringify(val)
  if M.isstr(val) then
    return val
  end
  return M.jsonstr(val)
end

--- Render a path as a dotted string.
function M.pathify(path)
  return table.concat(path or {}, '.')
end

return M

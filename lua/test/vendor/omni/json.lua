-- VENDORED: @voxgig/omni sdk-20260908-1556-0 (lua/src/json.lua)
-- Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
-- License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
-- The omni JSON value model and parser.
--
-- The omni runner must be able to test *any* library, and must add no
-- third-party dependencies, so it carries its own JSON support.
--
-- Lua tables cannot hold nil, and cannot tell an empty list from an empty
-- map, so the model is explicit: NULL and ABSENT are sentinel values, and
-- every container carries a metatable saying which it is.

local M = {}

local MAPMT = { __omni = 'map' }
local LISTMT = { __omni = 'list' }

-- A JSON null. Lua's own nil cannot be stored in a table.
M.NULL = setmetatable({}, { __tostring = function() return 'NULL' end })

-- No value at all, as distinct from a JSON null.
M.ABSENT = setmetatable({}, { __tostring = function() return 'ABSENT' end })

--- Tag a table as a JSON object.
function M.map(entries)
  return setmetatable(entries or {}, MAPMT)
end

--- Tag a table as a JSON array.
function M.list(entries)
  return setmetatable(entries or {}, LISTMT)
end

function M.ismap(val)
  return 'table' == type(val) and MAPMT == getmetatable(val)
end

function M.islist(val)
  return 'table' == type(val) and LISTMT == getmetatable(val)
end

function M.isnode(val)
  return M.ismap(val) or M.islist(val)
end

function M.isabsent(val)
  return nil == val or M.ABSENT == val
end

function M.isnull(val)
  return M.NULL == val
end

function M.isnone(val)
  return M.isabsent(val) or M.isnull(val)
end

--- A JSON number? Booleans are not numbers.
function M.isnum(val)
  return 'number' == type(val)
end

function M.isstr(val)
  return 'string' == type(val)
end

--- Read a map entry. Returns ABSENT when missing.
function M.get(val, key)
  if not M.ismap(val) then
    return M.ABSENT
  end
  local entry = rawget(val, key)
  if nil == entry then
    return M.ABSENT
  end
  return entry
end

function M.has(val, key)
  return M.ismap(val) and nil ~= rawget(val, key)
end

-- ---- parser ----------------------------------------------------------

local function skipws(text, pos)
  local at = pos
  while at <= #text do
    local ch = text:sub(at, at)
    if ' ' == ch or '\t' == ch or '\n' == ch or '\r' == ch then
      at = at + 1
    else
      break
    end
  end
  return at
end

local parsevalue

local function parseword(text, pos, word, value)
  if word == text:sub(pos, pos + #word - 1) then
    return value, pos + #word
  end
  error('omni: bad JSON literal at ' .. pos, 0)
end

local function parsestring(text, pos)
  if '"' ~= text:sub(pos, pos) then
    error('omni: expected string at ' .. pos, 0)
  end

  local at = pos + 1
  local out = {}

  while at <= #text do
    local ch = text:sub(at, at)

    if '"' == ch then
      return table.concat(out), at + 1
    end

    if '\\' ~= ch then
      out[#out + 1] = ch
      at = at + 1
    else
      local escape = text:sub(at + 1, at + 1)
      at = at + 2

      if '"' == escape then
        out[#out + 1] = '"'
      elseif '\\' == escape then
        out[#out + 1] = '\\'
      elseif '/' == escape then
        out[#out + 1] = '/'
      elseif 'b' == escape then
        out[#out + 1] = '\b'
      elseif 'f' == escape then
        out[#out + 1] = '\f'
      elseif 'n' == escape then
        out[#out + 1] = '\n'
      elseif 'r' == escape then
        out[#out + 1] = '\r'
      elseif 't' == escape then
        out[#out + 1] = '\t'
      elseif 'u' == escape then
        local code = tonumber(text:sub(at, at + 3), 16)
        at = at + 4
        if nil == code then
          error('omni: bad JSON unicode escape', 0)
        end
        out[#out + 1] = utf8 and utf8.char(code) or string.char(code % 256)
      else
        error('omni: bad JSON escape at ' .. at, 0)
      end
    end
  end

  error('omni: unterminated JSON string', 0)
end

local function parsemap(text, pos)
  local out = M.map({})
  local at = skipws(text, pos + 1)

  if '}' == text:sub(at, at) then
    return out, at + 1
  end

  while true do
    at = skipws(text, at)
    local key
    key, at = parsestring(text, at)
    at = skipws(text, at)

    if ':' ~= text:sub(at, at) then
      error('omni: expected \':\' at ' .. at, 0)
    end

    local value
    value, at = parsevalue(text, skipws(text, at + 1))
    rawset(out, key, value)
    at = skipws(text, at)

    local ch = text:sub(at, at)
    if ',' == ch then
      at = at + 1
    elseif '}' == ch then
      return out, at + 1
    else
      error('omni: expected \',\' or \'}\' at ' .. at, 0)
    end
  end
end

local function parselist(text, pos)
  local out = M.list({})
  local at = skipws(text, pos + 1)

  if ']' == text:sub(at, at) then
    return out, at + 1
  end

  while true do
    local value
    value, at = parsevalue(text, skipws(text, at))
    out[#out + 1] = value
    at = skipws(text, at)

    local ch = text:sub(at, at)
    if ',' == ch then
      at = at + 1
    elseif ']' == ch then
      return out, at + 1
    else
      error('omni: expected \',\' or \']\' at ' .. at, 0)
    end
  end
end

local function parsenumber(text, pos)
  local span = text:match('^[-+]?[0-9]*%.?[0-9]+[eE]?[-+]?[0-9]*', pos)
  if nil == span then
    error('omni: bad JSON number at ' .. pos, 0)
  end
  local value = tonumber(span)
  if nil == value then
    error('omni: bad JSON number [' .. span .. '] at ' .. pos, 0)
  end
  return value, pos + #span
end

parsevalue = function(text, pos)
  if pos > #text then
    error('omni: unexpected end of JSON', 0)
  end

  local ch = text:sub(pos, pos)

  if '{' == ch then
    return parsemap(text, pos)
  elseif '[' == ch then
    return parselist(text, pos)
  elseif '"' == ch then
    return parsestring(text, pos)
  elseif 't' == ch then
    return parseword(text, pos, 'true', true)
  elseif 'f' == ch then
    return parseword(text, pos, 'false', false)
  elseif 'n' == ch then
    return parseword(text, pos, 'null', M.NULL)
  end

  return parsenumber(text, pos)
end

--- Parse JSON text into the omni value model.
function M.parse(text)
  local value, pos = parsevalue(text, skipws(text, 1))
  pos = skipws(text, pos)

  if pos <= #text then
    error('omni: trailing JSON content at ' .. pos, 0)
  end

  return value
end

return M

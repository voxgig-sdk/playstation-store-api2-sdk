-- VENDORED: @voxgig/omni sdk-20260908-1556-0 (lua/src/regex.lua)
-- Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
-- License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
-- A small backtracking regex engine.
--
-- Omni specs match error messages with `/pattern/` expectations, so every
-- port needs a regex. Lua has patterns, not regular expressions - no
-- alternation, no grouping quantifiers - so omni carries this engine, a
-- direct port of the Rust one (rust/src/regex.rs).
--
-- Supported: literals, `.`, `^`, `$`, `|`, groups `(...)`, classes
-- `[a-z0-9_]` and `[^...]`, quantifiers `* + ? {m} {m,} {m,n}` (greedy,
-- and lazy with a trailing `?`), and the escapes `\d \D \w \W \s \S \n
-- \r \t` plus any escaped punctuation.

local M = {}

-- ---- parser ----------------------------------------------------------

local parsealt

local function isdigit(ch)
  return nil ~= ch and ch:match('^%d$')
end

local function escapenode(escape)
  if 'd' == escape then
    return { kind = 'class', items = { { kind = 'digit' } }, negated = false }
  elseif 'D' == escape then
    return { kind = 'class', items = { { kind = 'digit' } }, negated = true }
  elseif 'w' == escape then
    return { kind = 'class', items = { { kind = 'word' } }, negated = false }
  elseif 'W' == escape then
    return { kind = 'class', items = { { kind = 'word' } }, negated = true }
  elseif 's' == escape then
    return { kind = 'class', items = { { kind = 'space' } }, negated = false }
  elseif 'S' == escape then
    return { kind = 'class', items = { { kind = 'space' } }, negated = true }
  elseif 'n' == escape then
    return { kind = 'char', ch = '\n' }
  elseif 'r' == escape then
    return { kind = 'char', ch = '\r' }
  elseif 't' == escape then
    return { kind = 'char', ch = '\t' }
  end
  return { kind = 'char', ch = escape }
end

local function parseclass(chars, pos)
  local at = pos + 1
  local negated = false

  if '^' == chars[at] then
    negated = true
    at = at + 1
  end

  local items = {}
  local first = true

  while at <= #chars do
    local ch = chars[at]

    if ']' == ch and not first then
      return { kind = 'class', items = items, negated = negated }, at + 1
    end
    first = false

    if '\\' == ch then
      local escape = chars[at + 1]
      at = at + 2
      if 'd' == escape then
        items[#items + 1] = { kind = 'digit' }
      elseif 'w' == escape then
        items[#items + 1] = { kind = 'word' }
      elseif 's' == escape then
        items[#items + 1] = { kind = 'space' }
      elseif 'n' == escape then
        items[#items + 1] = { kind = 'char', ch = '\n' }
      elseif 'r' == escape then
        items[#items + 1] = { kind = 'char', ch = '\r' }
      elseif 't' == escape then
        items[#items + 1] = { kind = 'char', ch = '\t' }
      else
        items[#items + 1] = { kind = 'char', ch = escape }
      end
    else
      at = at + 1
      if '-' == chars[at] and ']' ~= chars[at + 1] and nil ~= chars[at + 1] then
        items[#items + 1] = { kind = 'range', from = ch, to = chars[at + 1] }
        at = at + 2
      else
        items[#items + 1] = { kind = 'char', ch = ch }
      end
    end
  end

  error('omni: unterminated regex class', 0)
end

local function parsecount(chars, pos)
  local at = pos + 1
  local minstr = ''

  while isdigit(chars[at]) do
    minstr = minstr .. chars[at]
    at = at + 1
  end

  if '' == minstr then
    return nil
  end

  local min = tonumber(minstr)

  if '}' == chars[at] then
    return min, min, at + 1
  end

  if ',' ~= chars[at] then
    return nil
  end
  at = at + 1

  local maxstr = ''
  while isdigit(chars[at]) do
    maxstr = maxstr .. chars[at]
    at = at + 1
  end

  if '}' ~= chars[at] then
    return nil
  end

  if '' == maxstr then
    return min, nil, at + 1
  end

  return min, tonumber(maxstr), at + 1
end

local function parseatom(chars, pos)
  local ch = chars[pos]

  if '(' == ch then
    local at = pos + 1
    if '?' == chars[at] and ':' == chars[at + 1] then
      at = at + 2
    end

    local inner
    inner, at = parsealt(chars, at)

    if ')' ~= chars[at] then
      error('omni: unbalanced regex group', 0)
    end

    return inner, at + 1
  end

  if '[' == ch then
    return parseclass(chars, pos)
  end

  if '.' == ch then
    return { kind = 'any' }, pos + 1
  end

  if '^' == ch then
    return { kind = 'start' }, pos + 1
  end

  if '$' == ch then
    return { kind = 'end' }, pos + 1
  end

  if '\\' == ch then
    local escape = chars[pos + 1]
    if nil == escape then
      error('omni: trailing backslash in regex', 0)
    end
    return escapenode(escape), pos + 2
  end

  return { kind = 'char', ch = ch }, pos + 1
end

local function parserepeat(chars, pos, atom)
  local ch = chars[pos]
  local min, max, at

  if '*' == ch then
    min, max, at = 0, nil, pos + 1
  elseif '+' == ch then
    min, max, at = 1, nil, pos + 1
  elseif '?' == ch then
    min, max, at = 0, 1, pos + 1
  elseif '{' == ch then
    min, max, at = parsecount(chars, pos)
    if nil == at then
      return atom, pos
    end
  else
    return atom, pos
  end

  local greedy = true
  if '?' == chars[at] then
    greedy = false
    at = at + 1
  end

  return { kind = 'repeat', inner = atom, min = min, max = max, greedy = greedy }, at
end

local function parseseq(chars, pos)
  local nodes = {}
  local at = pos

  while at <= #chars and '|' ~= chars[at] and ')' ~= chars[at] do
    local atom
    atom, at = parseatom(chars, at)
    atom, at = parserepeat(chars, at, atom)
    nodes[#nodes + 1] = atom
  end

  return { kind = 'seq', nodes = nodes }, at
end

parsealt = function(chars, pos)
  local branches = {}
  local branch
  local at = pos

  branch, at = parseseq(chars, at)
  branches[#branches + 1] = branch

  while '|' == chars[at] do
    branch, at = parseseq(chars, at + 1)
    branches[#branches + 1] = branch
  end

  if 1 == #branches then
    return branches[1], at
  end

  return { kind = 'alt', branches = branches }, at
end

-- ---- matcher ---------------------------------------------------------

local function isword(ch)
  return nil ~= ch:match('^[%w_]$')
end

local function classmatch(items, negated, ch)
  local hit = false

  for _, item in ipairs(items) do
    local ok
    if 'char' == item.kind then
      ok = ch == item.ch
    elseif 'range' == item.kind then
      ok = item.from <= ch and ch <= item.to
    elseif 'digit' == item.kind then
      ok = nil ~= ch:match('^%d$')
    elseif 'word' == item.kind then
      ok = isword(ch)
    elseif 'space' == item.kind then
      ok = nil ~= ch:match('^%s$')
    end

    if ok then
      hit = true
      break
    end
  end

  if negated then
    return not hit
  end
  return hit
end

local matchnode
local matchseq
local matchrepeat

matchnode = function(node, chars, pos, cont)
  local kind = node.kind

  if 'char' == kind then
    return pos <= #chars and chars[pos] == node.ch and cont(pos + 1)
  elseif 'any' == kind then
    return pos <= #chars and cont(pos + 1)
  elseif 'class' == kind then
    return pos <= #chars and classmatch(node.items, node.negated, chars[pos]) and cont(pos + 1)
  elseif 'start' == kind then
    return 1 == pos and cont(pos)
  elseif 'end' == kind then
    return #chars + 1 == pos and cont(pos)
  elseif 'seq' == kind then
    return matchseq(node.nodes, 1, chars, pos, cont)
  elseif 'alt' == kind then
    for _, branch in ipairs(node.branches) do
      if matchnode(branch, chars, pos, cont) then
        return true
      end
    end
    return false
  elseif 'repeat' == kind then
    return matchrepeat(node, 0, chars, pos, cont)
  end

  return false
end

matchseq = function(nodes, index, chars, pos, cont)
  if index > #nodes then
    return cont(pos)
  end

  return matchnode(nodes[index], chars, pos, function(next)
    return matchseq(nodes, index + 1, chars, next, cont)
  end)
end

matchrepeat = function(node, count, chars, pos, cont)
  local canmore = nil == node.max or count < node.max

  local function takemore()
    if not canmore then
      return false
    end
    return matchnode(node.inner, chars, pos, function(next)
      -- A zero-width repeat would loop forever.
      return next > pos and matchrepeat(node, count + 1, chars, next, cont)
    end)
  end

  local function stopnow()
    return count >= node.min and cont(pos)
  end

  if node.greedy then
    return takemore() or stopnow()
  end

  return stopnow() or takemore()
end

--- Is the pattern found anywhere in the text?
function M.find(pattern, text)
  local chars = {}
  for index = 1, #pattern do
    chars[index] = pattern:sub(index, index)
  end

  local ok, root = pcall(function()
    local node, at = parsealt(chars, 1)
    if at <= #chars then
      error('omni: bad regex: ' .. pattern, 0)
    end
    return node
  end)

  if not ok then
    return false
  end

  local subject = {}
  for index = 1, #text do
    subject[index] = text:sub(index, index)
  end

  for start = 1, #subject + 1 do
    if matchnode(root, subject, start, function() return true end) then
      return true
    end
  end

  return false
end

return M

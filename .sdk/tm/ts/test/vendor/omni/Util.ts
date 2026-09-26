// VENDORED: @voxgig/omni 0.1.4 (typescript/src/Util.ts)
// Source: https://github.com/voxgig/omni @ b909ff51fc644e4955c850e30cc65e74be076df2  [tag: sdk-20260925-1316-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.

// A JSON value: null, boolean, number, string, list or map.
export type Json = any

const NULLMARK = '__NULL__' // Value is JSON null.
const UNDEFMARK = '__UNDEF__' // Value is not present (thus, undefined).
const EXISTSMARK = '__EXISTS__' // Value exists (not undefined).

// A map (JSON object)?
function ismap(val: Json): boolean {
  return null != val && 'object' === typeof val && !Array.isArray(val)
}

// A list (JSON array)?
function islist(val: Json): boolean {
  return Array.isArray(val)
}

// A container (map or list)?
function isnode(val: Json): boolean {
  return ismap(val) || islist(val)
}

// Deep copy a JSON value. Non-JSON values (functions, class instances) are
// passed through by reference - the runner only ever clones test data.
function clone(val: Json): Json {
  if (islist(val)) {
    return val.map((entry: Json) => clone(entry))
  }

  if (ismap(val)) {
    const out: Record<string, Json> = {}
    for (const key of Object.keys(val)) {
      out[key] = clone(val[key])
    }
    return out
  }

  return val
}

// Read a value from a nested structure by path. The path is a list of
// string keys (map) or integer-like keys (list). Returns undefined when
// any step is missing.
function getpath(val: Json, path: (string | number)[]): Json {
  let current = val

  for (const part of path) {
    if (islist(current)) {
      const index = 'number' === typeof part ? part : parseInt(String(part), 10)
      if (isNaN(index) || index < 0 || index >= current.length) {
        return undefined
      }
      current = current[index]
    } else if (ismap(current)) {
      const key = String(part)
      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        return undefined
      }
      current = current[key]
    } else {
      return undefined
    }
  }

  return current
}

// Depth-first walk, applying `apply` to every node and leaf, children
// first, then the containing node. `apply` may replace the value.
function walk(
  val: Json,
  apply: (key: string | number | undefined, val: Json, parent: Json, path: (string | number)[]) => Json,
  key?: string | number,
  parent?: Json,
  path?: (string | number)[],
): Json {
  const curpath = path || []

  if (isnode(val)) {
    if (islist(val)) {
      for (let index = 0; index < val.length; index++) {
        val[index] = walk(val[index], apply, index, val, [...curpath, index])
      }
    } else {
      for (const childkey of Object.keys(val)) {
        val[childkey] = walk(val[childkey], apply, childkey, val, [...curpath, childkey])
      }
    }
  }

  return apply(key, val, parent, curpath)
}

// Deep structural equality. Numbers compare by value (1 and 1.0 are the
// same), booleans never equal numbers, map key order is not significant.
function deepequal(a: Json, b: Json): boolean {
  if (a === b) {
    return true
  }

  if (null == a || null == b) {
    // undefined and null are distinct: only both-absent compares equal.
    return (undefined === a && undefined === b) || (null === a && null === b)
  }

  const atype = typeof a
  const btype = typeof b

  if ('number' === atype && 'number' === btype) {
    return a === b || (isNaN(a) && isNaN(b))
  }

  if (atype !== btype) {
    return false
  }

  if (islist(a) && islist(b)) {
    if (a.length !== b.length) {
      return false
    }
    for (let index = 0; index < a.length; index++) {
      if (!deepequal(a[index], b[index])) {
        return false
      }
    }
    return true
  }

  if (ismap(a) && ismap(b)) {
    const akeys = Object.keys(a)
    const bkeys = Object.keys(b)
    if (akeys.length !== bkeys.length) {
      return false
    }
    for (const key of akeys) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) {
        return false
      }
      if (!deepequal(a[key], b[key])) {
        return false
      }
    }
    return true
  }

  return false
}

function jsonstr(val: Json, seen?: Set<any>): string {
  if (undefined === val) {
    return 'undefined'
  }

  if (null === val) {
    return 'null'
  }

  if ('string' === typeof val) {
    return JSON.stringify(val)
  }

  if ('number' === typeof val) {
    return Number.isFinite(val) ? String(val) : 'null'
  }

  if ('boolean' === typeof val) {
    return val ? 'true' : 'false'
  }

  if (islist(val) || ismap(val)) {
    seen = seen || new Set()

    if (seen.has(val)) {
      return '"[Circular]"'
    }

    seen.add(val)

    const out = islist(val)
      ? '[' + val.map((entry: Json) => jsonstr(entry, seen)).join(',') + ']'
      : '{' + Object.keys(val).sort()
        .map((key) => JSON.stringify(key) + ':' + jsonstr((val as any)[key], seen))
        .join(',') + '}'

    seen.delete(val)

    return out
  }

  if ('function' === typeof val) {
    return '[Function' + (val.name ? ' ' + val.name : '') + ']'
  }

  return JSON.stringify(String(val))
}

// Human readable form of a value: strings are shown verbatim (so that
// error-message matching is exact), everything else as compact JSON.
function stringify(val: Json): string {
  return 'string' === typeof val ? val : jsonstr(val)
}

// Render a path as a dotted string.
function pathify(path: (string | number)[]): string {
  return (path || []).map((part) => String(part)).join('.')
}

export {
  NULLMARK,
  UNDEFMARK,
  EXISTSMARK,
  clone,
  deepequal,
  getpath,
  islist,
  ismap,
  isnode,
  jsonstr,
  pathify,
  stringify,
  walk,
}

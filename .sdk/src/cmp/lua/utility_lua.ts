
import * as Path from 'node:path'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


function formatLuaTable(obj: any, indent: number = 0): string {
  if (obj == null) {
    return 'nil'
  }

  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '{}'
    }
    const items = obj.map(v => padInner + formatLuaValue(v, indent + 1)).join(',\n')
    return `{\n${items},\n${pad}}`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return '{}'
    }
    const items = entries
      .map(([k, v]) => `${padInner}["${k}"] = ${formatLuaValue(v, indent + 1)}`)
      .join(',\n')
    return `{\n${items},\n${pad}}`
  }

  return formatLuaValue(obj, indent)
}


function formatLuaValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'nil'
  }
  if (typeof val === 'string') {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  if (typeof val === 'number') {
    return String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (Array.isArray(val)) {
    return formatLuaTable(val, indent)
  }
  if (typeof val === 'object') {
    return formatLuaTable(val, indent)
  }
  return String(val)
}


const MODEL_META = ['index$', 'key$', 'val$']

// Keys whose value IS the default the runtime already assumes when the key is
// absent, so emitting them is pure payload.
const CONFIG_DEFAULT: Record<string, any> = {
  active: true,
  req: false,
  reqd: false,
}

// Subtrees carrying user payload rather than schema. An active:true inside an
// OpenAPI example is DATA, not a default, so default-pruning stops at these
// keys and everything below them is passed through untouched.
const PAYLOAD_KEYS = ['default', 'example', 'examples']

function clean(o: any, dropDefaults?: boolean): any {
  const prune = (node: any, defaults: boolean): any => {
    if (Array.isArray(node)) {
      return node.map((n: any) => prune(n, defaults))
    }
    if (null != node && 'object' === typeof node) {
      const out: any = {}
      for (const k of Object.keys(node)) {
        if (MODEL_META.includes(k)) {
          continue
        }
        if (defaults && k in CONFIG_DEFAULT && CONFIG_DEFAULT[k] === node[k]) {
          continue
        }
        out[k] = prune(node[k], defaults && !PAYLOAD_KEYS.includes(k))
      }
      return out
    }
    return node
  }
  return prune(o, true === dropDefaults)
}



function luaLongString(s: string): string {
  let level = 0
  while (s.includes(']' + '='.repeat(level) + ']')) {
    level++
  }
  const eq = '='.repeat(level)
  // A long bracket swallows an immediately following newline, so start the
  // content on the same line as the opener.
  return '[' + eq + '[' + s + ']' + eq + ']'
}

export {
  luaLongString,
  clean,
  formatLuaTable,
  formatLuaValue,
  projectPath,
}

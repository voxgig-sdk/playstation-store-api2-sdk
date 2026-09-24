
import * as Path from 'node:path'


import {
  camelify,
  canonKey,
  canonScalarKey,
  each,
  opParams,
  exampleVarName,
  names,
} from '@voxgig/sdkgen'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}



// The declared canon-type sentinel of a named parameter of an op — looked up
// in the op's `points[].g.params[]` exactly as the typed-model generator
// does. Falls back to the entity field of the same name (used when the op
// has no params and the request shape mirrors the entity fields). Returns
// undefined when neither is present.
function paramCanonType(entity: any, op: any, paramName: string): unknown {
  const params = op ? each(opParams(op)) : []
  const found = (params as any[]).find((p: any) => p && p.n === paramName)
  if (found) {
    return found.t
  }
  const field = (entity && entity.fields ? each(entity.fields) : [])
    .find((f: any) => f && f.n === paramName) as any
  return field && field.t
}


// A type-correct Go example literal for a named match/data parameter of an
// op, derived entirely from the model. INTEGER/NUMBER render as the bare
// number `1`, BOOLEAN as `true`, ARRAY as the empty `[]any{}` and OBJECT as
// the empty `map[string]any{}`, everything else (STRING, unknown, missing)
// as the quoted `placeholder`.
function exampleValue(entity: any, op: any, paramName: string, placeholder: string): string {
  // canonScalarKey, not canonKey: a nullable field's sentinel is the union
  // ['`$ONE`', ['`$NUMBER`','`$NULL`']], which canonKey stringifies into
  // nothing recognizable — so a `number | null` id fell through to the
  // quoted placeholder and the example failed to compile against the type
  // generated from that very sentinel.
  const key = canonScalarKey(paramCanonType(entity, op, paramName))
  if ('INTEGER' === key || 'NUMBER' === key) {
    return '1'
  }
  if ('BOOLEAN' === key) {
    return 'true'
  }
  if ('ARRAY' === key) {
    return '[]any{}'
  }
  if ('OBJECT' === key) {
    return 'map[string]any{}'
  }
  if ('NULL' === key) {
    return 'nil'
  }
  return `"${placeholder}"`
}


function goVarName(name: string): string {
  const pascal = camelify(name)
  return exampleVarName(pascal.charAt(0).toLowerCase() + pascal.slice(1), 'go')
}


function formatGoMap(obj: any, indent: number = 0): string {
  if (obj == null) {
    return 'nil'
  }

  const pad = '\t'.repeat(indent)
  const padInner = '\t'.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]any{}'
    }
    const items = obj.map(v => padInner + formatGoValue(v, indent + 1)).join(',\n')
    return `[]any{\n${items},\n${pad}}`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return 'map[string]any{}'
    }
    const items = entries
      .map(([k, v]) => `${padInner}${formatGoString(k)}: ${formatGoValue(v, indent + 1)}`)
      .join(',\n')
    return `map[string]any{\n${items},\n${pad}}`
  }

  return formatGoValue(obj, indent)
}


function formatGoString(value: string): string {
  return JSON.stringify(value).replace(/\uFEFF/g, '\\ufeff')
}


function formatGoValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'nil'
  }
  if (typeof val === 'string') {
    return formatGoString(val)
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return String(val)
    }
    return String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (Array.isArray(val)) {
    return formatGoMap(val, indent)
  }
  if (typeof val === 'object') {
    return formatGoMap(val, indent)
  }
  return String(val)
}


const MODEL_META = ['index$', 'key$', 'val$']

const CONFIG_DEFAULT: Record<string, any> = {
  active: true,
  req: false,
  reqd: false,
}

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



function goFeatureName(feat: any): string {
  if (null == feat.Name) {
    names(feat, feat.name)
  }
  return feat.Name
}


export {
  goFeatureName,
  clean,
  exampleValue,
  formatGoMap,
  formatGoString,
  formatGoValue,
  goVarName,
  projectPath,
}

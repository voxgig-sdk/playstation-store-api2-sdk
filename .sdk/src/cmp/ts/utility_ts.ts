
import * as Path from 'node:path'


import {
  canonKey,
  canonScalarKey,
  each,
  opParams,
} from '@voxgig/sdkgen'

import {
  clone,
  walk,
} from '@voxgig/struct'



// The declared canon-type sentinel of a named parameter of an op — looked up
// in the op's `points[].g.params[]` exactly as the typed-model generator
// does. Falls back to the entity field of the same name (used when the op
// has no params and the generated match type is `Partial<Entity>`). Returns
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
    return '[]'
  }
  if ('OBJECT' === key) {
    return '{}'
  }
  if ('NULL' === key) {
    return 'null'
  }
  return `'${placeholder}'`
}


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


function formatJSONSrc(jsonsrc: string) {
  return jsonsrc
    .replace(/([{:\[,])/g, '$1 ')
    .replace(/([}\]])/g, ' $1')
}


function formatJson(obj: any, flags?: { line?: boolean, margin?: number }): string {
  const marginSize = flags?.margin ?? 0
  const marginStr = ' '.repeat(marginSize)

  let json: string

  if (flags?.line) {
    json = JSON.stringify(obj)
      .replace(/([{:\[,])/g, '$1 ')
      .replace(/([}\]])/g, ' $1')
  }
  else {
    json = JSON.stringify(obj, null, 2)
  }

  if (marginSize > 0) {
    json = json.split('\n').map(line => marginStr + line).join('\n')
  }

  return json
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


export {
  clean,
  formatJSONSrc,
  formatJson,
  projectPath,
  exampleValue,
}

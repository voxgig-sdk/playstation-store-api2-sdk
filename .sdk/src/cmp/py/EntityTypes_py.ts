


import {
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape, warnEntityTypeCollisions , deriveEntityNames } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'py'


// Python keywords that cannot be used as class-syntax TypedDict field names.
const PY_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])


function pyIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !PY_KEYWORDS.has(name)
}


function emitTypedDict(typeName: string, items: any[], log?: any): void {
  const usable = items.filter((it: any) => it && null != it.name && pyIdent(it.name))

  items.forEach((it: any) => {
    if (it && null != it.name && !pyIdent(it.name) && log && log.warn) {
      log.warn({
        point: 'entity-types-skip-field', typeName, field: it.name,
        note: `py: field "${it.name}" of ${typeName} has no legal class-syntax ` +
          `TypedDict key form; omitted from the typed model (still reachable ` +
          `via the runtime dict)`,
      })
    }
  })

  const required = usable.filter((it: any) => !it.optional)
  const optional = usable.filter((it: any) => it.optional)

  const field = (it: any) => `    ${it.name}: ${canonToType(it.type, LANG)}
`

  if (0 === usable.length) {
    Content(`class ${typeName}(TypedDict):
    pass
`)
    return
  }

  if (0 === required.length) {
    Content(`class ${typeName}(TypedDict, total=False):
`)
    optional.forEach((it: any) => Content(field(it)))
    return
  }

  if (0 === optional.length) {
    Content(`class ${typeName}(TypedDict):
`)
    required.forEach((it: any) => Content(field(it)))
    return
  }

  Content(`class ${typeName}Required(TypedDict):
`)
  required.forEach((it: any) => Content(field(it)))
  Content(`

class ${typeName}(${typeName}Required, total=False):
`)
  optional.forEach((it: any) => Content(field(it)))
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model, log } = props.ctx$
  const target = props.target || {}
  const ext = target.ext || LANG

  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  // Emit for EVERY entity that gets generated entity code: the consumer
  // scaffold (create-sdkgen Root.ts) iterates entities WITHOUT an active
  // filter, so inactive entities still get class files referencing these
  // typed names. Filter on `name` (always present), NOT `active` — parity
  // with the go emitter's fix.
  const entityList = deriveEntityNames(entity)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go emitter's fix.

  warnEntityTypeCollisions(entity, log, LANG)

  File({ name: model.const.Name.toLowerCase() + '_types.' + ext }, () => {

    Content(`# Typed models for the ${model.const.Name} SDK.
#
# GENERATED from the API model: main.${KIT}.entity.<e>.fields{} and per-op
# params (op.<name>.points[].g.params[]). Field/param types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Do not edit by hand.
#
# These are TypedDicts, not dataclasses: the SDK ops return/accept plain dicts
# at runtime, and a TypedDict IS a dict shape, so the types match the runtime.
# Optional (req:false) keys are modelled as TypedDict key-optionality
# (total=False), split into a required base + total=False subclass when a type
# has both required and optional keys.

from __future__ import annotations

from typing import TypedDict, Any
`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.a !== false)

      Content(`

`)
      emitTypedDict(Name, fields.map((f: any) => ({
        name: f.n, type: f.t, optional: false === f.r,
      })), log)

      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        Content(`

`)
        emitTypedDict(typeName, items, log)
      })
    })
  })
})


export {
  EntityTypes,
}

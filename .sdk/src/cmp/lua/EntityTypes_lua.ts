


import {
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape, warnEntityTypeCollisions , deriveEntityNames } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'lua'


function propKey(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : '[' + JSON.stringify(name) + ']'
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { target } = props
  const { model, log } = props.ctx$

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

  File({ name: model.name + '_types.' + (target.ext || LANG) }, () => {

    Content(`-- Typed models for the ${model.const.Name} SDK (LuaLS annotations).
--
-- GENERATED from the API model: main.${KIT}.entity.<e>.fields{} and per-op
-- params (op.<name>.points[].g.params[]). Field/param types come from the
-- canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
-- @voxgig/apidef VALID_CANON). Annotations only — no runtime effect. Do not
-- edit by hand.

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.a !== false)

      Content(`---@class ${Name}
`)
      fields.forEach((f: any) => {
        const opt = false === f.r ? '?' : ''
        Content(`---@field ${propKey(f.n)}${opt} ${canonToType(f.t, LANG)}
`)
      })
      Content(`
`)

      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        Content(`---@class ${typeName}
`)
        items.forEach((it: any) => {
          const opt = it.optional ? '?' : ''
          Content(`---@field ${propKey(it.name)}${opt} ${canonToType(it.type, LANG)}
`)
        })
        Content(`
`)
      })
    })

    Content(`local M = {}

return M
`)
  })
})


export {
  EntityTypes,
}

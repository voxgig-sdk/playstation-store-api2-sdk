


import {
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape, warnEntityTypeCollisions , deriveEntityNames, rbSafeTypeName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'rb'


// A Ruby symbol literal for a member name: bare for identifiers, quoted otherwise.
function symName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*[?!=]?$/.test(name) ? ':' + name : ':"' + name + '"'
}


function emitStruct(
  typeName: string,
  doc: string,
  allmembers: Array<{ name: string, type: unknown, optional: boolean }>,
) {
  const members = allmembers.filter((m) => '' !== String(m.name ?? '').trim())

  let block = `# ${doc}\n`

  members.forEach((m) => {
    const t = canonToType(m.type, LANG)
    const ret = m.optional ? `[${t}, nil]` : `[${t}]`
    block += `#\n# @!attribute [rw] ${m.name}\n#   @return ${ret}\n`
  })

  if (0 === members.length) {
    block += `class ${typeName}\nend\n\n`
    Content(block)
    return
  }

  block += `${typeName} = Struct.new(\n`
  members.forEach((m) => {
    block += `  ${symName(m.name)},\n`
  })
  block += `  keyword_init: true\n)\n\n`

  Content(block)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model, log } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  const entityList = deriveEntityNames(entity)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go emitter's fix.

  warnEntityTypeCollisions(entity, log, LANG)

  File({ name: model.const.Name + '_types.' + LANG }, () => {

    Content(`# frozen_string_literal: true

# Typed models for the ${model.const.Name} SDK.
#
# GENERATED from the API model: main.${KIT}.entity.<e>.fields{} and per-op
# params (op.<name>.points[].g.params[]). Member types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Ruby types are unenforced; these YARD
# annotations document the shapes. Do not edit by hand.

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const TypeName = rbSafeTypeName(Name)
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.a !== false)

      emitStruct(
        TypeName,
        `${Name} entity data model.`,
        fields.map((f: any) => ({ name: f.n, type: f.t, optional: false === f.r })),
      )

      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        emitStruct(
          typeName,
          `Request payload for ${Name}#${opname}.`,
          items,
        )
      })
    })
  })
})


export {
  EntityTypes,
}

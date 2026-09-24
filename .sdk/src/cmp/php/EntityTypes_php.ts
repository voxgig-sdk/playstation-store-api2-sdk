


import {
  cmp, each, names,
  File, Content, Folder,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape, warnEntityTypeCollisions , deriveEntityNames, phpSafeTypeName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'php'


function validName(name: string): boolean {
  return /^[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*$/.test(name)
}


function propLine(name: string, sentinel: unknown, optional: boolean): string {
  const type = canonToType(sentinel, LANG)
  if ('mixed' === type || 'null' === type) {
    return optional
      ? `    public mixed $${name} = null;\n`
      : `    public mixed $${name};\n`
  }
  return optional
    ? `    public ?${type} $${name} = null;\n`
    : `    public ${type} $${name};\n`
}


const EntityTypes = cmp(function EntityTypes(props: any) {
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

  Folder({ name: 'types' }, () => {

    File({ name: model.const.Name + 'Types.' + LANG }, () => {

      Content(`<?php
declare(strict_types=1);

// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields{} and per-op
// params (op.<name>.points[].g.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.
//
// These are documentation-grade value objects (PHP 8 typed properties),
// registered on the composer classmap autoload. The SDK boundary exchanges
// assoc-arrays; these classes name the shapes for tooling and typed callers.

`)

      entityList.forEach((ent: any) => {
        const Name = ent.Name
        const fields = (ent.fields ? each(ent.fields) : [])
          .filter((f: any) => f.a !== false && validName(f.n))

        const TypeName = phpSafeTypeName(Name)

        Content(`/** ${Name} entity data model. */
class ${TypeName}
{
`)
        fields.forEach((f: any) => {
          Content(propLine(f.n, f.t, false === f.r))
        })
        Content(`}

`)

        const ops = ent.op || {}
        ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
          if (null == ops[opname]) {
            return
          }

          const typeName = opTypeName(Name, opname)
          const { items } = opRequestShape(ent, opname)

          Content(`/** Request payload for ${Name}#${opname}. */
class ${typeName}
{
`)
          items.forEach((it: any) => {
            if (validName(it.name)) {
              Content(propLine(it.name, it.type, it.optional))
            }
          })
          Content(`}

`)
        })
      })
    })
  })
})


export {
  EntityTypes,
}

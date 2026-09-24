import {
  Content,
  File,
  cmp,
  entitySpecMap,
  optionSpec,
} from '@voxgig/sdkgen'


import {
  Model,
} from '@voxgig/apidef'


import {
  luaLongString,
} from './utility_lua'


const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  File({ name: 'schema.' + target.ext }, () => {
    Content(`-- ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
--
-- Generated from the model: \`main.kit.optspec\` and each feature's
-- \`config.options\` for OPTSPEC; entity \`fields{}.type\` for ENTITYSPEC.

local json = require("dkjson")

local OPTSPEC_DATA = ${luaLongString(JSON.stringify(optspec))}

local ENTITYSPEC_DATA = ${luaLongString(JSON.stringify(entityspec))}

-- Parsed ONCE, at require. The spec is read on every client construction and
-- never mutated, so a per-call parse would be pure waste — and sharing the
-- table is safe for the same reason: make_options validates AGAINST it and
-- writes into the options, never into the spec.
return {
  OPTSPEC = json.decode(OPTSPEC_DATA),
  ENTITYSPEC = json.decode(ENTITYSPEC_DATA),
}
`)
  })
})


export {
  Schema
}

import {
  Content,
  File,
  cmp,
  entitySpecMap,
  optionSpec,
  rawStringLiteral,
} from '@voxgig/sdkgen'


import {
  Model,
} from '@voxgig/apidef'


const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  File({ name: 'schema.' + target.ext }, () => {
    Content(`# ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
#
# Generated from the model: \`main.kit.optspec\` and each feature's
# \`config.options\` for OPTSPEC; entity \`fields{}.type\` for ENTITYSPEC.

require 'json'

module ${model.const.Name}Schema

  OPTSPEC_DATA = ${rawStringLiteral(JSON.stringify(optspec))}.freeze

  ENTITYSPEC_DATA = ${rawStringLiteral(JSON.stringify(entityspec))}.freeze

  # Parsed ONCE, at load. The spec is read on every client construction and
  # never mutated, so a per-call parse would be pure waste — and sharing the
  # hash is safe for the same reason: make_options validates AGAINST it and
  # writes into the options, never into the spec.
  OPTSPEC = JSON.parse(OPTSPEC_DATA).freeze

  ENTITYSPEC = JSON.parse(ENTITYSPEC_DATA).freeze

end
`)
  })
})


export {
  Schema
}

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


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The ruby peer of src/cmp/ts/Schema_ts.ts. Same two exports, same source —
// OPTSPEC from `main.kit.optspec` plus each feature's own `config.options`,
// ENTITYSPEC from the entity field sentinels — built by the shared helpers,
// so what ruby validates against and what ts validates against cannot drift.
//
// EMBEDDED AS JSON, PARSED AT LOAD, the mechanism config.rb already uses for
// the model above the size threshold, and SINGLE-quoted for the reason
// recorded there: a double-quoted ruby string would interpolate any `#{` the
// model happens to contain.
//
// The round-trip is exact because the spec holds only strings and booleans —
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts.
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
# \`config.options\` for OPTSPEC; entity \`fields[].type\` for ENTITYSPEC.

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

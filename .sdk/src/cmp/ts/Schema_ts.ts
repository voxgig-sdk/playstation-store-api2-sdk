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


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// Two exports, both struct.validate specs:
//
//   OPTSPEC     what makeOptions validates the caller's options against —
//               the standard options from `main.kit.optspec` plus one entry
//               per feature this target carries, built by helpers/optspec.
//
//   ENTITYSPEC  per entity, `{ data, op: { <opname> } }` — the record shape
//               and each operation's request shape, mapped from the field
//               type sentinels the model already carries (helpers/canonSpec).
//               Emitted as an EMPTY MAP unless the `validate` feature is
//               active, because nothing else reads it and every byte here is
//               a byte in the consumer's package.
//
// A JSON OBJECT LITERAL, not a parsed string: JSON is a subset of the
// language's own literal syntax, so the values land as data with no parse
// step, and the backticks the sentinels carry (`\`$STRING\``) survive because
// JSON.stringify quotes and escapes them. The config emitter has to choose
// between a literal and a parsed blob because the config can be megabytes;
// the spec is bounded by the model's field count, so it does not.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  File({ name: 'Schema.' + target.ext }, () => {
    Content(`// ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
//
// Generated from the model: \`main.kit.optspec\` and each feature's
// \`config.options\` for OPTSPEC; entity \`fields[].type\` for ENTITYSPEC.

const OPTSPEC = ${JSON.stringify(optspec, null, 2)}

const ENTITYSPEC = ${JSON.stringify(entityspec, null, 2)}

export {
  OPTSPEC,
  ENTITYSPEC,
}
`)
  })
})


export {
  Schema
}

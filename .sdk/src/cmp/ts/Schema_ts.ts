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
// \`config.options\` for OPTSPEC; entity \`fields{}.type\` for ENTITYSPEC.

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

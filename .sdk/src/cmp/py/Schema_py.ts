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

  File({ name: 'schema.' + target.ext }, () => {
    Content(`# ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
#
# Generated from the model: \`main.kit.optspec\` and each feature's
# \`config.options\` for OPTSPEC; entity \`fields{}.type\` for ENTITYSPEC.

from __future__ import annotations

import json
from typing import Any, Dict

_OPTSPEC_DATA = ${JSON.stringify(JSON.stringify(optspec))}

_ENTITYSPEC_DATA = ${JSON.stringify(JSON.stringify(entityspec))}

# Parsed ONCE, at import. The spec is read on every client construction and
# never mutated, so a per-call parse would be pure waste — and sharing the
# dict is safe for the same reason: make_options validates AGAINST it and
# writes into the options, never into the spec.
OPTSPEC: Dict[str, Any] = json.loads(_OPTSPEC_DATA)

ENTITYSPEC: Dict[str, Any] = json.loads(_ENTITYSPEC_DATA)
`)
  })
})


export {
  Schema
}

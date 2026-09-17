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
// The python peer of src/cmp/ts/Schema_ts.ts. Same two exports, same source:
// OPTSPEC from `main.kit.optspec` plus each feature's own `config.options`,
// ENTITYSPEC from the entity field sentinels — both built by the shared
// helpers, so what python validates against and what ts validates against
// cannot drift.
//
// EMBEDDED AS JSON, PARSED AT IMPORT, the same mechanism config.py already
// uses for the model above the size threshold. A python dict literal would
// also work here, but `json.loads` (the C accelerator) builds it from one
// string constant rather than making the byte-compiler walk several hundred
// literal nodes, and it is the one mechanism every ported target shares.
//
// The round-trip is exact because the spec holds only strings and booleans —
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts. JSON's single number type is the hazard that
// test exists for: `true`/`false` and `null` differ between JSON and python
// source, which is why this is a parsed string and not a literal paste.
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


import { cmp, Content, isAuthActive, envName, opRequestShape, entityIdField, entityOps, goModule , serverVariables} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue, goVarName } from './utility_go'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const gomodule = goModule(model, target.name)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  
  // Server variables (a templated server URL) are REQUIRED at construction
  // - the SDK refuses rather than request a URL with a literal
  // {account_id} in it - so a quickstart that omits them is a quickstart
  // that fails on its first line.
  const svars = serverVariables(model)
  const goServerField = 0 === svars.length ? '' :
    `\n    "server": map[string]any{` +
    svars.map((v: any) => `\n        "${v.name}": "<${v.name}>",`).join('') +
    `\n    },`

  const ctor = authActive
    ? `sdk.New${model.const.Name}SDK(map[string]any{\n        "apikey": os.Getenv("${envName(model)}_APIKEY"),${goServerField}\n    })`
    : ('' === goServerField
      ? `sdk.New()`
      : `sdk.New${model.const.Name}SDK(map[string]any{${goServerField}\n    })`)

  const body: string[] = []
  let usesFmt = false

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const eLower = goVarName(exampleEntity.name)
    const opnames = entityOps(exampleEntity)

    // Model-driven id key: null when the entity has no id-like field (a
    // response-wrapped spec). When null, load/remove pass a nil match and
    // update omits the id member.
    const idF = entityIdField(exampleEntity)

    const exampleFields = (opname: string): string[] => {
      const items = opRequestShape(exampleEntity, opname).items
        .filter((it: any) => (it.name !== idF && it.name !== 'id') ||
          ('create' === opname && !it.optional))
      const required = items.filter((it: any) => !it.optional)
      const optional = items.filter((it: any) => it.optional)
      // Required members must all appear or the payload is incomplete; pad
      // update (a patch) with a sample optional field or two.
      const chosen = 'create' === opname
        ? (required.length ? required : items.slice(0, 2))
        : required.concat(optional).slice(0, Math.max(2, required.length))
      return chosen.map((it: any) =>
        `"${it.name}": ${exampleValue(exampleEntity, exampleEntity.op[opname], it.name, 'example_' + it.name)}`)
    }

    // The full REQUIRED match for load/remove (id first, then parent path
    // params like page_id) — the same shape that generates the op's request
    // match, so the example always carries the keys the route needs.
    const matchArg = (opname: string): string => {
      const matchItems = opRequestShape(exampleEntity, opname).items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      return 0 < matchItems.length
        ? `map[string]any{${matchItems.map((it: any) =>
          `"${it.name}": ${exampleValue(exampleEntity, exampleEntity.op[opname], it.name,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')}}`
        : 'nil'
    }

    if (opnames.includes('list')) {
      body.push(`    // List ${eLower} records — the value is the array of records itself.`)
      body.push(`    ${eLower}s, err := client.${eName}(nil).List(nil, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    for _, item := range ${eLower}s.([]any) {`)
      body.push(`        fmt.Println(item)`)
      body.push(`    }`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('load')) {
      body.push(`    // Load a single ${eLower} — the value is the loaded record.`)
      body.push(`    ${eLower}, err := client.${eName}(nil).Load(${matchArg('load')}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(${eLower})`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('create')) {
      body.push(`    // Create a ${eLower}.`)
      body.push(`    created, err := client.${eName}(nil).Create(map[string]any{${exampleFields('create').join(', ')}}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(created)`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('update')) {
      // The id member (when the entity has an id-like key) plus example
      // patch fields — the same shape that generates the op's request data.
      const updateMembers = (idF
        ? [`"${idF}": ${exampleValue(exampleEntity, exampleEntity.op.update, idF, 'example_id')}`]
        : []).concat(exampleFields('update'))
      body.push(`    // Update a ${eLower}.`)
      body.push(`    updated, err := client.${eName}(nil).Update(map[string]any{${updateMembers.join(', ')}}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(updated)`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('remove')) {
      body.push(`    // Remove a ${eLower}.`)
      body.push(`    removed, err := client.${eName}(nil).Remove(${matchArg('remove')}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(removed)`)
      body.push(``)
      usesFmt = true
    }
  }

  while (body.length > 0 && body[body.length - 1] === '') {
    body.pop()
  }

  const imports: string[] = []
  if (usesFmt) imports.push(`    "fmt"`)
  if (authActive) imports.push(`    "os"`)
  imports.push(`    sdk "${gomodule}"`)

  let program = `package main

import (
${imports.join('\n')}
)

func main() {
    client := ${ctor}

`
  if (body.length > 0) {
    program += body.join('\n') + '\n'
  } else {
    program += `    _ = client\n`
  }
  program += `}`

  Content(`### Quickstart

A complete program: create a client, then call the entity operations.
Each operation returns \`(value, error)\` — the value is the data itself
(there is no \`{ok, data}\` wrapper), so check \`err\` and use the value
directly.

\`\`\`go
${program}
\`\`\`

`)

})


export {
  ReadmeQuick
}

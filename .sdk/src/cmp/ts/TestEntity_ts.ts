import { pointFacts } from '@voxgig/sdkgen'
import { buildIdNames } from '@voxgig/sdkgen'
import { flowSteps } from '@voxgig/sdkgen'

import * as Path from 'node:path'


import {
  flatten,
  items,
  join,
  jsonify,
  slice,
} from '@voxgig/struct'

import {
  KIT,
  Model,
  ModelEntity,
  ModelEntityFlow,
  ModelEntityFlowStep,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  Content,
  File,
  Folder,
  Fragment,
  Slot,
  cmp,
  each,
  isAuthActive,
  serverVarEnv,
  serverVariables,
  isHttpBasicAuth,
  entityDataIdField, envName, envToken,
  jsKey,
  jsProp,
  hasLiveScenarios,
} from '@voxgig/sdkgen'


import {
  projectPath
} from './utility_ts'


type GenCtx = {
  model: Model
  entity: ModelEntity
  flow: ModelEntityFlow
  PROJUPPER: string
}

type OpGen = (ctx: GenCtx, step: ModelEntityFlowStep, index: number) => void


const TestEntity = cmp(function TestEntity(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity: ModelEntity = props.entity

  const PROJENVNAME = envName(model)
  const ENTENVNAME = envToken(entity.name)
  const authActive = isAuthActive(model)
  const authBasic = authActive && isHttpBasicAuth(model)
  const apikeyEnvEntry = authActive
    ? `\n    '${PROJENVNAME}_APIKEY': '',${authBasic ? `\n    '${PROJENVNAME}_SECRET': '',` : ''}`
    : ''
  const apikeyLiveField = authActive
    ? `
        apikey: env.${PROJENVNAME}_APIKEY,${authBasic ? `
        secret: env.${PROJENVNAME}_SECRET,` : ''}`
    : ''

  const svars = serverVariables(model)
  const serverEnvEntry = svars
    .map((v: any) => `\n    '${serverVarEnv(PROJENVNAME, v.name)}': ${JSON.stringify(v.dflt)},`).join('')
  const serverLiveField = 0 === svars.length ? '' : `
        server: {${svars
      .map((v: any) => `
          ${jsKey(v.name)}: ${jsProp('env', serverVarEnv(PROJENVNAME, v.name))},`).join('')}
        },`

  const ff = projectPath('src/cmp/ts/fragment/')

  Folder({ name: entity.name }, () => {

    File({ name: nom(entity, 'Name') + 'Entity.test.' + target.name }, () => {

      Fragment({
        from: ff + 'Entity.test.fragment.ts',
        replace: {
          SdkName: nom(model.const, 'Name'),
          EntityName: nom(entity, 'Name'),
          entityname: entity.name,
          PROJECTNAME: PROJENVNAME,
          ...stdrep,
        }
      }, () => {

        const basicflow = getModelPath(model, `main.${KIT}.flow.Basic${nom(entity, 'Name')}Flow`)

        const dobasic = basicflow && true === basicflow.active
        const liveFacts = Object.fromEntries(Object.values(entity.op || {}).flatMap((op: any) =>
          (op.points || []).map((point: any) => [point.m + ' ' + point.o, pointFacts(ctx$, point)])))

        if (!dobasic) {
          return;
        }

        const indent = 2

        const idlist = buildIdNames(entity, basicflow)

        Slot({ name: 'basicSetup' }, () => {
          Content(`
function basicSetup(extra?: any) {
  // TODO: fix test def options
  const options: any = {} // ${jsonify(basicflow.test, { offset: indent - 2 })}

  // TODO: needs test utility to resolve path
  const entityDataFile =
    Path.resolve(__dirname, 
      '../../../../.sdk/test/entity/${entity.name}/${nom(entity, 'Name')}TestData.json')

  // TODO: file ready util needed?
  const entityDataSource = Fs.readFileSync(entityDataFile).toString('utf8')

  // TODO: need a xlang JSON parse utility in voxgig/struct with better error msgs
  const entityData = JSON.parse(entityDataSource)

  options.entity = entityData.existing

  let client = ${model.Name}SDK.test(options, extra)
  const struct = client.utility().struct
  const merge = struct.merge
  const transform = struct.transform

  let idmap = transform(
    ['${join(idlist, '\',\'')}'],
    {
      '\`$PACK\`': ['', {
        '\`$KEY\`': '\`$COPY\`',
        '\`$VAL\`': ['\`$FORMAT\`', 'upper', '\`$COPY\`']
      }]
    })

  const env = envOverride({
    '${PROJENVNAME}_TEST_${ENTENVNAME}_ENTID': idmap,
    '${PROJENVNAME}_TEST_LIVE': 'FALSE',
    '${PROJENVNAME}_TEST_EXPLAIN': 'FALSE',${apikeyEnvEntry}${serverEnvEntry}
  })

  idmap = env['${PROJENVNAME}_TEST_${ENTENVNAME}_ENTID']

  const live = 'TRUE' === env.${PROJENVNAME}_TEST_LIVE

  const transport = createLiveTransport()
  if (live) {
    const rawIds = process.env['${PROJENVNAME}_TEST_${ENTENVNAME}_ENTID']
    idmap = rawIds && rawIds.trim() ? JSON.parse(rawIds) : {}
    if (!idmap || Array.isArray(idmap) || typeof idmap !== 'object') {
      throw new Error('Live ENTID must be a JSON object')
    }
    client = new ${model.Name}SDK(merge([
      // FIRST, so the generated fields below win: sdk-test-control.json's
      // test.client.options adds to the live client, it does not redirect it.
      liveClientOptions(),
      {${apikeyLiveField}${serverLiveField}
      },
      // 'extra || {}', not a bare 'extra': struct.merge returns UNDEFINED when the
      // last entry is undefined, and basicSetup is normally called with no
      // argument at all - so a bare 'extra' silently discarded the apikey
      // and server values above and handed the SDK undefined. Harmless
      // while there was nothing in that object; not harmless now.
      extra || {},
      { system: { fetch: transport.fetch } }
    ]))
  }

  const setup = {
    idmap,
    env,
    options,
    client,
    struct,
    data: entityData,
    explain: 'TRUE' === env.${PROJENVNAME}_TEST_EXPLAIN,
    live,
    transport,
    now: Date.now(),
  }

  return setup
}
  `)
        })


        Slot({ name: 'basic' }, () => {
          const flowHasCreate = Object.values(flowSteps(basicflow)).some(
            (s: any) => s.o === 'create'
          )

          // The basic test exercises a flow with one or more ops (load,
          // list, create, update, remove, ...). The control file lets users
          // skip per-op for an entity. Since the flow is sequential and
          // dependent (e.g. update needs prior load), skipping ANY op the
          // flow exercises skips the whole basic test.
          const flowOps = Array.from(new Set(
            (flowSteps(basicflow) as any[]).map((s: any) => s.o).filter(Boolean)
          ))
          const flowOpsLiteral = '[' + flowOps.map((o: any) => `'${o}'`).join(', ') + ']'

          Content(`
    const live = 'TRUE' === process.env.${PROJENVNAME}_TEST_LIVE
    for (const op of ${flowOpsLiteral}) {
      if (!live && maybeSkipControl(t, 'entityOp', '${entity.name}.' + op, live)) return
    }

    ${hasLiveScenarios(model) ? `if (live) { t.skip('Covered by live operation scenarios'); return }` : ''}
    const setup = basicSetup()
    if (setup.live) {
      return runLiveEntity(setup, ${JSON.stringify(entity)}, ${JSON.stringify(basicflow)}, '${nom(entity, 'Name')}', ${JSON.stringify(liveFacts)})
    }
    const client = setup.client
    const struct = setup.struct

    const isempty = struct.isempty
    const select = struct.select

`)

          // When the flow has no create step, bootstrap the entity data variable
          // from existing test data so that subsequent update/load/remove steps
          // can reference it.
          if (!flowHasCreate) {
            const ref01 = entity.name + '_ref01'
            Content(`    let ${ref01}_data = Object.values(setup.data.existing.${entity.name})[0] as any
`)
          }

          const genCtx: GenCtx = {
            model, entity, flow: basicflow, PROJUPPER: PROJENVNAME,
          }
          each(flowSteps(basicflow), (step: ModelEntityFlowStep, index: number) => {
            // Never emit a REMOVE (or its removed-item verify LIST) without a
            // preceding CREATE: a coherent CRUD flow only removes what it made,
            // so a create-less remove would mutate pre-existing (live) data.
            if (!flowHasCreate) {
              if ('remove' === step.o) { return }
              if ('list' === step.o &&
                (step.v || []).some((v: any) => 'ItemNotExists' === v.apply)) { return }
            }
            const opgen = GENERATE_OP[step.o]
            if (null != opgen) {
              opgen(genCtx, step, index)
              Content('\n')
            }
          })
        })
      })
    })
  })
})


const generateCreate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.i.ref ?? entity.name + '_ref01'
  const entvar = step.i.entvar ?? ref + '_ent'
  const datavar = step.i.datavar ?? (ref + '_data' + (step.i.suffix ?? ''))

  const priorSteps = flowSteps(flow).slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.o))

  const hasDatvar = priorSteps.some(s => {
    if ('create' === s.o) {
      const priorRef = s.i.ref ?? entity.name + '_ref01'
      const priorDatvar = s.i.datavar ?? (priorRef + '_data' + (s.i.suffix ?? ''))
      return priorDatvar === datavar
    }
    return false
  })

  Content(`
    // CREATE
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  if (hasDatvar) {
    Content(`    ${datavar} = setup.data.new.${entity.name}['${ref}']
`)
  } else {
    Content(`    let ${datavar} = setup.data.new.${entity.name}['${ref}']
`)
  }

  each(step.m, (mi: any) => {
    Content(`    ${datavar}['${mi.key$}'] = setup.idmap['${mi.val$}']
`)
  })

  const hasEntIdC = null != entity.id

  Content(`
    ${datavar} = (await ${entvar}.create(${datavar})).data()
`)
  if (hasEntIdC) {
    Content(`    assert(null != ${datavar}.id)
`)
  }
  else {
    Content(`    assert(null != ${datavar})
`)
  }
}


const generateList: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const hasDataId = null != entityDataIdField(entity)
  const ref = step.i.ref ?? entity.name + '_ref01'
  const entvar = step.i.entvar ?? ref + '_ent'
  const matchvar = step.i.matchvar ?? (ref + '_match' + (step.i.suffix ?? ''))
  const listvar = step.i.listvar ?? (ref + '_list' + (step.i.suffix ?? ''))

  const priorSteps = flowSteps(flow).slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.o))

  Content(`
    // LIST
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  Content(`    const ${matchvar}: any = {}
`)

  each(step.m, (mi: any) => {
    Content(`    ${matchvar}['${mi.key$}'] = setup.idmap['${mi.val$}']
`)
  })

  Content(`
    const ${listvar} = (await ${entvar}.list(${matchvar})).map((e: any) => e.data())
`)
  const allSteps = flowSteps(flow)
  for (let vI = 0; vI < step.v.length; vI++) {
    const validator = step.v[vI]
    const validRef = validator.def?.ref
    const hasRefData = validRef && allSteps.some(s => 'create' === s.o &&
      ((s.i.ref ?? entity.name + '_ref01') === validRef))

    if ('ItemExists' === validator.apply && hasRefData && hasDataId) {
      Content(`
    assert(!isempty(select(${listvar}, { id: ${validRef}_data.id })))
`)
    }
    else if ('ItemNotExists' === validator.apply && hasRefData && hasDataId) {
      Content(`
    assert(isempty(select(${listvar}, { id: ${validRef}_data.id })))
`)
    }
  }
}


const generateUpdate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.i.ref ?? entity.name + '_ref01'
  const entvar = step.i.entvar ?? ref + '_ent'
  const datavar = step.i.datavar ?? (ref + '_data' + (step.i.suffix ?? ''))
  const resdatavar = step.i.resdatavar ?? (ref + '_resdata' + (step.i.suffix ?? ''))
  const markdefvar = step.i.markdefvar ?? (ref + '_markdef' + (step.i.suffix ?? ''))
  const srcdatavar = step.i.srcdatavar ?? (ref + '_data' + (step.i.suffix ?? ''))

  const priorSteps = flowSteps(flow).slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.o))

  const hasEntIdU = null != entity.id

  Content(`
    // UPDATE
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  Content(`    const ${datavar}: any = {}
`)
  if (hasEntIdU) {
    Content(`    ${datavar}.id = ${srcdatavar}.id
`)
  }

  each(step.d, (mi: any) => {
    if ('id' !== mi.key$) {
      Content(`    ${datavar} ['${mi.key$}'] = setup.idmap['${mi.key$}']
`)
    }
  })


  for (let sI = 0; sI < step.s.length; sI++) {
    const spec = step.s[sI]
    if ('TextFieldMark' === spec.apply && null != step.i.textfield) {
      const fieldname = step.i.textfield
      const fieldvalue = spec.def.mark
      Content(`
    const ${markdefvar} = { name: '${fieldname}', value: '${fieldvalue}_' + setup.now }
    ;(${datavar} as any)[${markdefvar}.name] = ${markdefvar}.value
`)
    }
  }

  Content(`
    const ${resdatavar} = (await ${entvar}.update(${datavar})).data()
`)
  if (hasEntIdU) {
    Content(`    assert(${resdatavar}.id === ${datavar}.id)
`)
  }
  else {
    Content(`    assert(null != ${resdatavar})
`)
  }

  for (let sI = 0; sI < step.s.length; sI++) {
    const spec = step.s[sI]
    if ('TextFieldMark' === spec.apply && null != step.i.textfield) {
      Content(`
    assert((${resdatavar} as any)[${markdefvar}.name] === ${markdefvar}.value)
`)
    }
  }

}


const generateLoad: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.i.ref ?? entity.name + '_ref01'
  const entvar = step.i.entvar ?? ref + '_ent'
  const matchvar = step.i.matchvar ?? (ref + '_match' + (step.i.suffix ?? ''))
  const datavar = step.i.datavar ?? (ref + '_data' + (step.i.suffix ?? ''))
  const srcdatavar = step.i.srcdatavar ?? (ref + '_data' + (step.i.suffix ?? ''))

  const priorSteps = flowSteps(flow).slice(0, Number(index))
  const hasEntVar = priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.o))

  // Check if srcdatavar was declared by a prior create step or by the
  // preamble bootstrap (which runs when the flow has no create step)
  const flowHasCreate = flowSteps(flow).some(s => s.o === 'create')
  const preambleRef = entity.name + '_ref01'
  const hasSrcData = (!flowHasCreate && srcdatavar === preambleRef + '_data') ||
    priorSteps.some(s => {
      if ('create' === s.o) {
        const priorRef = s.i.ref ?? entity.name + '_ref01'
        const priorDatvar = s.i.datavar ?? (priorRef + '_data' + (s.i.suffix ?? ''))
        return priorDatvar === srcdatavar
      }
      return false
    })

  const hasEntId = null != entity.id

  const loadOp = entity.op?.load
  const loadPoint = loadOp?.points?.[0]
  const loadPathParams = loadPoint?.g?.params || []
  const loadHasRequiredParams = loadPathParams.some((p: any) => p.r !== false)
  if (!hasEntId && loadHasRequiredParams) {
    if (!hasEntVar) {
      Content(`
    // LOAD: skipped — no entity id field and load requires path params.
    // Entity-var is declared here so later flow steps still compile.
    const ${entvar} = client.${nom(entity, 'Name')}()
`)
    }
    return
  }

  Content(`
    // LOAD
`)
  if (!hasEntVar) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  if (!hasSrcData && hasEntId) {
    Content(`    const ${srcdatavar} = Object.values(setup.data.existing.${entity.name})[0] as any
`)
  }
  if (hasEntId) {
    Content(`    const ${matchvar}: any = {}
    ${matchvar}.id = ${srcdatavar}.id
    const ${datavar} = (await ${entvar}.load(${matchvar})).data()
    assert(${datavar}.id === ${srcdatavar}.id)
`)
  }
  else {
    Content(`    const ${matchvar}: any = {}
    const ${datavar} = (await ${entvar}.load(${matchvar})).data()
    assert(null != ${datavar})
`)
  }
}


const generateRemove: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.i.ref ?? entity.name + '_ref01'
  const entvar = step.i.entvar ?? ref + '_ent'
  const matchvar = step.i.matchvar ?? (ref + '_match' + (step.i.suffix ?? ''))
  const srcdatavar = step.i.srcdatavar ?? (ref + '_data')

  const priorSteps = flowSteps(flow).slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.o))

  // "Remove what you created" needs the created record's id. An entity with
  // no DATA id field (entityDataIdField null — e.g. Multichannel's Template)
  // returns records without `.id`, so `${srcdatavar}.id` is absent (a py
  // KeyError; a silent nil elsewhere). Skip the flow-remove step for those —
  // the remove op is still exercised by the direct() test.
  if (null == entityDataIdField(entity)) {
    return
  }
  Content(`
    // REMOVE
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  // Always match the prior-created entity by id. The mock test feature
  // removes the first match in entmap, so without a specific id the
  // result depends on hash-sort order and flakes (see cheapshark).
  Content(`    const ${matchvar}: any = { id: ${srcdatavar}.id }
    await ${entvar}.remove(${matchvar})
  `)
}


const GENERATE_OP: Record<string, OpGen> = {
  create: generateCreate,
  list: generateList,
  update: generateUpdate,
  load: generateLoad,
  remove: generateRemove,
}


export {
  TestEntity
}

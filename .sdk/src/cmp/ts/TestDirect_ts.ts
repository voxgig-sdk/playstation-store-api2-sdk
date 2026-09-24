
import {
  Model,
  ModelEntity,
  ModelPoint,
  nom,
  depluralize,
} from '@voxgig/apidef'


import {
  Content,
  File,
  Folder,
  Fragment,
  Slot,
  cmp,
  snakify,
  isAuthActive,
  serverVarEnv,
  serverVariables,
  isHttpBasicAuth,
  jsProp,
  jsOptProp, envName, envToken, liveStrict,
  jsKey,
  pointParts,
  hasLiveScenarios,
} from '@voxgig/sdkgen'


import {
  projectPath
} from './utility_ts'


const TestDirect = cmp(function TestDirect(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity: ModelEntity = props.entity

  const ff = projectPath('src/cmp/ts/fragment/')

  const strict = liveStrict(model, target.name)

  const PROJECTNAME = envName(model)
  const entidEnvVar = `${PROJECTNAME}_TEST_${envToken(entity.name)}_ENTID`

  const authActive = isAuthActive(model)
  const authBasic = authActive && isHttpBasicAuth(model)
  const apikeyEnvEntry = authActive
    ? `\n    '${PROJECTNAME}_APIKEY': '',${authBasic ? `\n    '${PROJECTNAME}_SECRET': '',` : ''}`
    : ''
  const apikeyLiveField = authActive
    ? `
      apikey: env.${PROJECTNAME}_APIKEY,${authBasic ? `
      secret: env.${PROJECTNAME}_SECRET,` : ''}`
    : ''

  const svars = serverVariables(model)
  const serverEnvEntry = svars
    .map((v: any) => `\n    '${serverVarEnv(PROJECTNAME, v.name)}': ${JSON.stringify(v.dflt)},`).join('')
  const serverLiveField = 0 === svars.length ? '' : `
      server: {${svars
      .map((v: any) => `
        ${jsKey(v.name)}: ${jsProp('env', serverVarEnv(PROJECTNAME, v.name))},`).join('')}
      },`

  const opnames = Object.keys(entity.op || {})
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')

  if (!hasLoad && !hasList) {
    return
  }

  Folder({ name: entity.name }, () => {

    File({ name: nom(entity, 'Name') + 'Direct.test.' + target.name }, () => {

      Fragment({
        from: ff + 'Direct.test.fragment.ts',
        replace: {
          SdkName: nom(model.const, 'Name'),
          EntityName: nom(entity, 'Name'),
          entityname: entity.name,
          PROJECTNAME,
          ...stdrep,
        }
      }, () => {


        Slot({ name: 'directSetup' }, () => {
          Content(`
function liveScenariosActive() { return ${hasLiveScenarios(model)} && process.env.${PROJECTNAME}_TEST_LIVE === 'TRUE' }
function directSetup(mockres?: any) {
  const calls: any[] = []

  const env = envOverride({
    '${entidEnvVar}': {},
    '${PROJECTNAME}_TEST_LIVE': 'FALSE',${apikeyEnvEntry}${serverEnvEntry}
  })

  const live = 'TRUE' === env.${PROJECTNAME}_TEST_LIVE

  if (live) {
    const transport = createLiveTransport()
    // Merged so the generated fields win: sdk-test-control.json's
    // test.client.options adds to the live client, it does not redirect it.
    const client = new ${nom(model.const, 'Name')}SDK(
      Object.assign({}, liveClientOptions(), { system: { fetch: transport.fetch },${apikeyLiveField}${serverLiveField}
      }))

    let idmap: any = env['${entidEnvVar}']
    if ('string' === typeof idmap && idmap.startsWith('{')) {
      idmap = JSON.parse(idmap)
    }

    return { client, calls, live, idmap, transport }
  }

  const mockFetch = async (url: string, init: any) => {
    calls.push({ url, init })
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      json: async () => (null != mockres ? mockres : { id: 'direct01' }),
    }
  }

  const client = new ${nom(model.const, 'Name')}SDK({
    base: 'http://localhost:8080',
    system: { fetch: mockFetch },
  })

  return { client, calls, live, idmap: {} as any }
}

// direct() returns the raw response body. List endpoints often wrap the
// array in an envelope (e.g. { data: [...] }, { entities: [...] },
// { pagination, data: [...] }). The test transforms the raw body to
// extract the first array — either the body itself or the first array
// property of an envelope object.
function unwrapListData(data: any): any[] | null {
  if (Array.isArray(data)) return data
  if (data && 'object' === typeof data) {
    for (const v of Object.values(data)) {
      if (Array.isArray(v)) return v as any[]
    }
  }
  return null
}
  `)
        })


        Slot({ name: 'direct' }, () => {

          if (hasLoad) {
            generateDirectLoad(model, entity, strict)
          }

          if (hasList) {
            generateDirectList(model, entity, strict)
          }
        })

      })
    })
  })
})


function generateDirectGraphql(
  opname: 'load' | 'list',
  entity: ModelEntity,
  point: any,
  strict: boolean,
) {
  const doc: string = point.gq.doc
  const vars: any[] = point.gq.vars || []

  const varLine = (target: string, key: string, v: any) =>
    `      ${target}[${JSON.stringify(v.name)}] = ${key}`

  const mockVarLines = vars.map((v: any, i: number) =>
    varLine('variables', `'direct0${i + 1}'`, v)).join('\n')

  const liveVarLines = vars.map((v: any) => {
    const from = v.from || v.name
    const key = ('id' === from ? entity.name : from.replace(/_id$/, '')) + '01'
    return varLine('variables', `setup.idmap['${key}']`, v)
  }).join('\n')

  const liveIdKeys = vars.map((v: any) => {
    const from = v.from || v.name
    return ('id' === from ? entity.name : from.replace(/_id$/, '')) + '01'
  })

  const skipMissingLine = 0 < liveIdKeys.length
    ? `    if (skipIfMissingIds(t, setup, ${JSON.stringify(liveIdKeys)})) return\n`
    : ''

  const varAsserts = vars.map((_v: any, i: number) =>
    '      assert(calls[0].init.body.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  const offlineChecks = `      assert(result.ok === true)
      assert(result.status === 200)
      assert(null != result.data)
      assert(calls.length === 1)
      assert(calls[0].init.method === 'POST')
${varAsserts}`

  const checks = strict ?
    `    if (setup.live) {
      // STRICT live mode: a non-2xx is a real failure - this project owns
      // the server it points at, so there is nothing to be lenient about.
      //
      // What is NOT asserted here is the MOCK's own fixtures. \`direct01\`
      // is a scripted id and \`calls\` records the mock transport; neither
      // exists on a live run, so asserting them made strict mode mean
      // "compare the live server against the mock's script" - a suite that
      // could not pass against any real API, including this project's own.
      assert(result.ok === true,
        'Live request failed: HTTP ' + result.status)
      assert(result.status >= 200 && result.status < 300)
      assert(null != result.data)
    } else {
${offlineChecks}    }` :
    `    if (setup.live) {
      // Live mode is lenient: synthetic ids frequently fail server-side
      // validation. Skip rather than fail when the call doesn't come back
      // clean.
      if (!result.ok || result.status < 200 || result.status >= 300) {
        return
      }
    } else {
${offlineChecks}    }`

  Content(`
  test('direct-${opname}-${entity.name}', async (t: any) => {
    if (liveScenariosActive()) { t.skip('Covered by live operation scenarios'); return }
    const setup = directSetup()
    if (maybeSkipControl(t, 'direct', 'direct-${opname}-${entity.name}', setup.live)) return
${skipMissingLine}    const { client, calls } = setup

    const variables: any = {}
    if (setup.live) {
${liveVarLines || '      // no variables'}
    } else {
${mockVarLines || '      // no variables'}
    }

    const result: any = await client.graphql(${JSON.stringify(doc)}, variables)

${checks}
  })
`)
}


function generateDirectLoad(model: Model, entity: ModelEntity, strict: boolean) {
  const loadOp = entity.op?.load
  const loadPoint: ModelPoint | undefined = loadOp?.points?.[0]

  if (null == loadPoint) {
    return
  }

  if ('graphql' === (loadPoint as any).kind) {
    generateDirectGraphql('load', entity, loadPoint, strict)
    return
  }

  const allLoadParams = loadPoint.g?.params || []
  const loadPath = normalizePathParams(pointParts(loadPoint), allLoadParams, loadPoint.r?.param)

  // Some upstream OpenAPI specs declare a parameter as `in: path` even when
  // that path has no `{name}` placeholder for it. Only path params that
  // actually appear in the URL template should drive direct-test path-param
  // setup and URL-substitution asserts; otherwise the SDK silently drops
  // them and the URL-includes assert fails.
  const pathPlaceholders = new Set<string>()
  for (const part of pointParts(loadPoint)) {
    if (typeof part === 'string' && part.startsWith('{') && part.endsWith('}')) {
      pathPlaceholders.add(part.slice(1, -1))
    }
  }
  const renameMap = (loadPoint.r?.param || {}) as Record<string, string>
  const renamedPlaceholders = new Set<string>()
  for (const ph of pathPlaceholders) {
    renamedPlaceholders.add(ph)
    for (const [orig, renamed] of Object.entries(renameMap)) {
      if (renamed === ph) renamedPlaceholders.add(orig)
    }
  }
  const loadParams = allLoadParams.filter((p: any) =>
    renamedPlaceholders.has(p.n) || renamedPlaceholders.has(p.or))

  // Required query params that the spec advertises an example value for.
  // Live mode needs these on the request or the API returns 4xx; mock mode
  // ignores them. Optional query params (e.g. `app`, `version`) are skipped
  // even when they have examples — only the strictly required ones are
  // necessary to satisfy the contract.
  const loadQuery = loadPoint.g?.query || []
  const liveQueryEntries = loadQuery
    .filter((q: any) => q.r && undefined !== q.ex && null !== q.ex)
  const hasLiveQuery = liveQueryEntries.length > 0
  const liveQueryLines = liveQueryEntries
    .map((q: any) => `      ${jsProp('query', q.n)} = ${JSON.stringify(q.ex)}`)
    .join('\n')

  const listOp = entity.op?.list
  const listPoint = listOp?.points?.[0]
  const listParams = listPoint?.g?.params || []
  const listPath = listPoint ? normalizePathParams(pointParts(listPoint), listParams, listPoint.r?.param) : ''
  const hasList = null != listPoint

  const ancestorParams = loadParams.filter((p: any) => p.n !== 'id')

  const paramAsserts = loadParams.map((p: any, i: number) =>
    '      assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  const liveListParams = listParams.map((p: any) => {
    const key = p.n === 'id'
      ? entity.name + '01'
      : p.n.replace(/_id$/, '') + '01'
    return { name: p.n, key }
  })

  const liveAncestorParams = ancestorParams.map((p: any) => {
    const key = p.n.replace(/_id$/, '') + '01'
    return { name: p.n, key }
  })

  const liveQueryPrefix = liveQueryLines ? liveQueryLines + '\n' : ''

  // Path params with spec-provided examples — when present, prefer them
  // over list-bootstrap. The OpenAPI example values are by definition real
  // identifiers the API accepts (e.g. casa: "blue", fecha: "2024/01/01"),
  // so they avoid the brittleness of mapping list-response field names
  // back to load path-param names.
  const liveExampleParams = loadParams.filter(
    (p: any) => undefined !== p.ex && null !== p.ex
  )
  const allLoadParamsHaveExamples =
    loadParams.length > 0 && liveExampleParams.length === loadParams.length

  let liveIdKeys: string[] = []

  let liveParamsBlock = ''
  if (allLoadParamsHaveExamples) {
    const exampleLines = loadParams.map(
      (p: any) => `      ${jsProp('params', p.n)} = ${JSON.stringify(p.ex)}`
    ).join('\n')
    liveParamsBlock = `    if (setup.live) {
${liveQueryPrefix}${exampleLines}
    } else {
${loadParams.map((p: any, i: number) => `      ${jsProp('params', p.n)} = 'direct0${i + 1}'`).join('\n')}
    }`
  }
  else if (hasList) {
    // List-bootstrap pattern picks the load id from a list call's response,
    // so the test can succeed without ENTID env var. Ancestor params, if
    // any, still need ENTID overrides because the list call itself can need
    // them embedded.
    liveIdKeys = liveAncestorParams.map((lp: any) => lp.key)
    const listParamLines = liveListParams.map((lp: any) =>
      `        ${lp.name}: setup.idmap['${lp.key}'],`).join('\n')
    const ancestorParamLines = liveAncestorParams.map((lp: any) =>
      `      ${jsProp('params', lp.name)} = setup.idmap['${lp.key}']`).join('\n')
    const idParamName = loadParams.find((p: any) => p.n === 'id')
      ? 'id'
      : (loadParams[0]?.n ?? 'id')

    liveParamsBlock = `    if (setup.live) {
${liveQueryPrefix}      const listResult: any = await client.direct({
        path: '${listPath}',
        method: 'GET',
        params: {
${listParamLines}
        },
      })
      assert(listResult.ok && listResult.status >= 200 && listResult.status < 300,
        'Live list discovery failed')
      const listArr = unwrapListData(listResult.data)
      if (null == listArr || listArr.length === 0) {
        throw new Error('Live load blocked: discovery returned no entities')
      }
      const candidateId = ${jsOptProp('listArr[0]', idParamName)} ?? listArr[0]?.id
      if (null == candidateId) {
        throw new Error('Live load blocked: discovery returned no usable identity')
      }
      ${jsProp('params', idParamName)} = candidateId
${ancestorParamLines}
    } else {
${loadParams.map((p: any, i: number) => `      ${jsProp('params', p.n)} = 'direct0${i + 1}'`).join('\n')}
    }`
  } else if (hasLiveQuery || loadParams.length > 0) {
    // Synthetic-only fallback: if there are load params with no examples
    // and no list to bootstrap from, the live request would 4xx on
    // undefined values. Mark the path-param keys so the test skips when
    // ENTID overrides aren't supplied.
    if (loadParams.length > 0) {
      liveIdKeys = loadParams.map((p: any) => p.n + '01')
    }
    liveParamsBlock = `    if (setup.live) {
${liveQueryPrefix.replace(/\n$/, '')}
    } else {
${loadParams.map((p: any, i: number) => `      ${jsProp('params', p.n)} = 'direct0${i + 1}'`).join('\n')}
    }`
  } else {
    liveParamsBlock = ''
  }

  const skipMissingLine = liveIdKeys.length > 0
    ? `    if (skipIfMissingIds(t, setup, ${JSON.stringify(liveIdKeys)})) return\n`
    : ''

  // Live-mode leniency is a MODEL decision (main.kit.test.live.strict).
  // The default stays lenient: a fleet SDK generated against an arbitrary
  // public API 4xxes on synthetic IDs, and asserting would mean permanent
  // red. A project that owns its test server wants the opposite — without
  // it, the suite passes with nothing listening on the port.
  const offlineChecks = `      assert(result.ok === true)
      assert(result.status === 200)
      assert(null != result.data)
      assert(result.data.id === 'direct01')
      assert(calls.length === 1)
      assert(calls[0].init.method === 'GET')
${paramAsserts}`

  const loadChecks = strict ?
    `    if (setup.live) {
      // STRICT live mode: a non-2xx is a real failure - this project owns
      // the server it points at, so there is nothing to be lenient about.
      //
      // What is NOT asserted here is the MOCK's own fixtures. \`direct01\`
      // is a scripted id and \`calls\` records the mock transport; neither
      // exists on a live run, so asserting them made strict mode mean
      // "compare the live server against the mock's script" - a suite that
      // could not pass against any real API, including this project's own.
      assert(result.ok === true,
        'Live request failed: HTTP ' + result.status)
      assert(result.status >= 200 && result.status < 300)
      assert(null != result.data)
    } else {
${offlineChecks}    }` :
    `    if (setup.live) {
      // Live mode is lenient: synthetic IDs frequently 4xx. Skip rather
      // than fail when the load endpoint isn't reachable with the IDs we
      // can construct from setup.idmap.
      if (!result.ok || result.status < 200 || result.status >= 300) {
        return
      }
    } else {
${offlineChecks}    }`

  Content(`
  test('direct-load-${entity.name}', async (t: any) => {
    if (liveScenariosActive()) { t.skip('Covered by live operation scenarios'); return }
    const setup = directSetup({ id: 'direct01' })
    if (maybeSkipControl(t, 'direct', 'direct-load-${entity.name}', setup.live)) return
${skipMissingLine}    const { client, calls } = setup

    const params: any = {}
    const query: any = {}
${liveParamsBlock}

    const result: any = await client.direct({
      path: '${loadPath}',
      method: 'GET',
      params,
      query,
    })

${loadChecks}
  })
`)
}


function generateDirectList(model: Model, entity: ModelEntity, strict: boolean) {
  const listOp = entity.op?.list
  const listPoint: ModelPoint | undefined = listOp?.points?.[0]

  if (null == listPoint) {
    return
  }

  if ('graphql' === (listPoint as any).kind) {
    generateDirectGraphql('list', entity, listPoint, strict)
    return
  }

  const listParams = listPoint.g?.params || []
  const listPath = normalizePathParams(pointParts(listPoint), listParams, listPoint.r?.param)

  const listQuery = listPoint.g?.query || []
  const liveQueryLines = listQuery
    .filter((q: any) => q.r && undefined !== q.ex && null !== q.ex)
    .map((q: any) => `      ${jsProp('query', q.n)} = ${JSON.stringify(q.ex)}`)
    .join('\n')

  const liveParams = listParams.map((p: any) => {
    const key = p.n === 'id'
      ? entity.name + '01'
      : p.n.replace(/_id$/, '') + '01'
    return { name: p.n, key }
  })

  const paramAsserts = listParams.map((p: any, i: number) =>
    '      assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  let paramsBlock = ''
  if (listParams.length > 0 || liveQueryLines) {
    const liveLines = [
      liveQueryLines,
      liveParams.map((lp: any) =>
        `      ${jsProp('params', lp.name)} = setup.idmap['${lp.key}']`).join('\n'),
    ].filter(Boolean).join('\n')
    const mockLines = listParams.map((p: any, i: number) =>
      `      ${jsProp('params', p.n)} = 'direct0${i + 1}'`).join('\n')

    paramsBlock = `    const params: any = {}
    const query: any = {}
    if (setup.live) {
${liveLines}
    }${mockLines ? ` else {
${mockLines}
    }` : ''}
`
  } else {
    paramsBlock = `    const params: any = {}
    const query: any = {}
`
  }

  const liveIdKeys: string[] = listParams.length > 0
    ? liveParams.map((lp: any) => lp.key)
    : []
  const skipMissingLine = liveIdKeys.length > 0
    ? `    if (skipIfMissingIds(t, setup, ${JSON.stringify(liveIdKeys)})) return\n`
    : ''

  const offlineChecks = `      assert(result.ok === true)
      assert(result.status === 200)
      assert(null != result.data)
      const listArr = unwrapListData(result.data)
      assert(Array.isArray(listArr))
      assert(listArr!.length === 2)
      assert(calls.length === 1)
      assert(calls[0].init.method === 'GET')
${paramAsserts}`

  const listChecks = strict ?
    `    if (setup.live) {
      // STRICT live mode: a non-2xx is a real failure - this project owns
      // the server it points at, so there is nothing to be lenient about.
      //
      // What is NOT asserted here is the MOCK's own fixtures. \`direct01\`
      // is a scripted id and \`calls\` records the mock transport; neither
      // exists on a live run, so asserting them made strict mode mean
      // "compare the live server against the mock's script" - a suite that
      // could not pass against any real API, including this project's own.
      assert(result.ok === true,
        'Live request failed: HTTP ' + result.status)
      assert(result.status >= 200 && result.status < 300)
      assert(Array.isArray(unwrapListData(result.data)), 'Expected live list response')
    } else {
${offlineChecks}    }` :
    `    if (setup.live) {
      // Live mode is lenient: synthetic IDs frequently 4xx and the list-
      // response shape varies wildly across public APIs. Skip rather than
      // fail when the call doesn't return a usable list.
      if (!result.ok || result.status < 200 || result.status >= 300) {
        return
      }
      const listArr = unwrapListData(result.data)
      if (!Array.isArray(listArr)) {
        return
      }
    } else {
${offlineChecks}    }`

  Content(`
  test('direct-list-${entity.name}', async (t: any) => {
    if (liveScenariosActive()) { t.skip('Covered by live operation scenarios'); return }
    const setup = directSetup([{ id: 'direct01' }, { id: 'direct02' }])
    if (maybeSkipControl(t, 'direct', 'direct-list-${entity.name}', setup.live)) return
${skipMissingLine}    const { client, calls } = setup

${paramsBlock}
    const result: any = await client.direct({
      path: '${listPath}',
      method: 'GET',
      params,
      query,
    })

${listChecks}
  })
`)
}


function normalizePathParams(
  parts: string[],
  params: any[],
  rename?: Record<string, string>
): string {
  return parts.map((part: string) => {
    return part.replace(/\{([^}]+)\}/g, (match: string, rawName: string) => {
      const snaked = snakify(rawName)
      const depluralized = depluralize(snaked)
      // Prefer exact name match — orig matches can collide when one param's
      // original name was renamed to another param's current name (e.g. badge
      // load: param 'group_id' has orig 'id', and another param has name 'id').
      const param = params.find((p: any) =>
          p.n === snaked || p.n === depluralized) ||
        params.find((p: any) =>
          p.or === snaked || p.or === depluralized)
      if (param) return '{' + param.n + '}'

      // Reverse-lookup through rename mapping: if rawName is a renamed value
      // (e.g. "id"), find the original camelCase key (e.g. "closureId"),
      // snakify+depluralize it (e.g. "closure_id"), and match against params.
      if (rename) {
        for (const [origCamel, renamedTo] of Object.entries(rename)) {
          if (renamedTo === rawName) {
            const origSnaked = snakify(origCamel)
            const origDepluralized = depluralize(origSnaked)
            const renamedParam = params.find(
              (p: any) => p.or === origSnaked || p.n === origSnaked ||
                p.or === origDepluralized || p.n === origDepluralized
            )
            if (renamedParam) return '{' + renamedParam.n + '}'
          }
        }
      }

      return match
    })
  }).join('/')
}


export {
  TestDirect
}

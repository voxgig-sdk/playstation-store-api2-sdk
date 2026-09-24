import assert from 'node:assert/strict'
import { LiveBlocked, runLiveSteps, assertLiveReport, createLiveTransport } from './live-runner'
import { requestContract, synthesizeInput, validateContract } from './live-contract'
import { liveClientOptions, liveDelayMs, isControlSkipped } from './utility'

const at = (value: any, path?: string): any => (path || '').split('.').filter(Boolean).reduce((v, k) => v?.[k], value)
export function resolveRecipe(recipe: any, values: Map<string, any>): any {
  if (Array.isArray(recipe)) return recipe.map(v => resolveRecipe(v, values))
  if (recipe && typeof recipe === 'object') {
    if (recipe.from) {
      if (!values.has(recipe.from)) throw new LiveBlocked('Missing recipe output: ' + recipe.from)
      let value = values.get(recipe.from)
      if (recipe.where) {
        if (!Array.isArray(value)) throw new LiveBlocked('Discovery output is not a list')
        value = value.find((item: any) => Object.entries(recipe.where).every(([k, v]) => at(item, k) === v) &&
          (!recipe.related || (values.get(recipe.related.from) || []).some((other: any) =>
            at(item, recipe.related.local) === at(other, recipe.related.foreign) &&
            Object.entries(recipe.related.where || {}).every(([k, v]) => at(other, k) === v))))
      }
      value = at(value, recipe.path)
      if (value === undefined || value === null) throw new LiveBlocked('Discovery found no compatible value')
      return value
    }
    return Object.fromEntries(Object.entries(recipe).map(([k, v]) => [k, resolveRecipe(v, values)]))
  }
  return recipe
}

export function recipeNeeds(value: any): string[] {
  if (!value || typeof value !== 'object') return []
  return [...new Set([...(typeof value.from === 'string' ? [value.from] : []), ...Object.values(value).flatMap(recipeNeeds)])]
}

export async function runLiveScenarios(SDK: any, plan: any[], envPrefix: string, liveDefaults: any = {}) {
  const transport = createLiveTransport()
  const steps = plan.map(point => {
    const hint = point.facts.live || {}
    const control = isControlSkipped('entityOp', point.entity + '.' + point.op, 'live')
    return { role: hint.auth || (point.facts.security?.length === 0 || point.facts.securitySource === 'unspecified' ? 'public' : 'account'), retention: hint.retention, id: hint.id || point.id, needs: [...new Set([...(hint.needs || []), ...recipeNeeds(hint.input), ...recipeNeeds(hint.credential), ...recipeNeeds(hint.assert)])] as string[],
      cleanup: !!hint.cleanup,
      excluded: control.skip ? control.reason || 'Excluded by test control' : hint.excluded,
      run: async (ctx: any) => {
        transport.enter(ctx)
        // Every operation point is planned, not only the hinted ones; a hint
        // only decides whether this file is generated. Absent a recipe there
        // is no consent to call the operation, so block rather than
        // synthesize input for it. Blocked fails assertLiveReport, so an
        // omission surfaces instead of passing quietly.
        if (!point.facts.live) throw new LiveBlocked('No live recipe: add a live hint for this operation in the guide, or give it an explicit excluded reason')
        if (point.contractVersion && point.contractVersion !== 1) throw new LiveBlocked('Unsupported operation contract version')
        if (point.op === 'remove' || hint.cleanup) {
          const owned = recipeNeeds(hint.input).some(id => plan.some(source =>
            (source.facts.live?.id || source.id) === id && source.entity === point.entity && source.op === 'create'))
          if (!owned) throw new LiveBlocked('Cleanup input is not bound to a resource created by this run')
        }
        if (!point.reachable) throw new LiveBlocked('Point selector is indistinguishable; add a guide action')
        const request = requestContract(point.facts)
        const explicit = hint.input === undefined ? request.example : resolveRecipe(hint.input, ctx.values)
        let input = request.schema ? synthesizeInput(request.schema, explicit) : explicit ?? {}
        for (const kind of ['params', 'query', 'header', 'cookie']) for (const arg of point.args?.[kind] || []) {
          if (arg.r && input[arg.n] === undefined) {
            if (arg.ex === undefined) throw new LiveBlocked('Missing required argument: ' + arg.n)
            input[arg.n] = arg.ex
          }
        }
        const role = hint.auth || (point.facts.security?.length === 0 || point.facts.securitySource === 'unspecified' ? 'public' : 'account')
        let apikey = role === 'public' ? null : role === 'issued' ? resolveRecipe(hint.credential, ctx.values) : process.env[envPrefix + '_APIKEY']
        if (role === 'issued' && (typeof apikey !== 'string' || !apikey)) throw new LiveBlocked('Issued credential unavailable')
        let wire: any
        let wireSchema: any
        const options = liveClientOptions()
        const client = new SDK({ ...options, ...liveDefaults, apikey,
          feature: { ...options.feature, test: { active: false }, retry: { active: false },
            secrets: { ...options.feature?.secrets, active: role === 'account' && (!apikey || options.feature?.secrets?.active === true) } },
          system: { ...options.system, fetch: async (url: any, init: any) => {
            const headers = new Headers(init?.headers)
            if (role === 'public') assert(!headers.has('authorization'), 'Public request carries authentication')
            else if (!headers.get('authorization')) throw new LiveBlocked('Credential unavailable for ' + role + ' request')
            const response = await transport.fetch(url, { ...init, redirect: 'error' })
            const expectedPath = point.path.replace(/\{([^}]+)\}/g, (_: string, name: string) => encodeURIComponent(input[point.rename?.param?.[name] || name] ?? input[name]))
            if (point.kind === 'graphql') {
              const payload = JSON.parse(init.body)
              assert.equal(payload.query, point.graphql.doc, 'Entity selected wrong GraphQL operation')
            } else assert.equal(new URL(String(url)).pathname, expectedPath, 'Entity selected wrong route')
            assert.equal(init?.method || 'GET', point.method)
            assert(response.status >= 200 && response.status < 300, 'Unsuccessful HTTP response')
            if (point.kind === 'graphql') wire = await response.clone().json()
            const def = point.facts.responses?.[response.status] || point.facts.responses?.[String(response.status)[0] + 'XX'] || point.facts.responses?.default
            if (point.facts.responses && !def) throw new Error('Undeclared response status')
            if (def) {
              const schema = def.content?.['application/json']?.schema ?? def.schema
              if (schema && response.status !== 204) { wireSchema = schema; wire = await response.clone().json() }
            }
            return response
          } } })
        if (point.action) input = { ...input, $action: point.action }
        assert(JSON.stringify(input).length <= 1024 * 1024, 'Request exceeds test payload limit')
        const result = await client[point.accessor]()[point.op](input)
        const data = Array.isArray(result) ? result.map(item => { assert.equal(typeof item?.data, 'function'); return item.data() }) : (assert.equal(typeof result?.data, 'function'), result.data())
        ctx.publish(data)
        if (wireSchema) validateContract(wireSchema, wire, 'response')
        if (Array.isArray(wire?.errors) && wire.errors.length) throw new Error('GraphQL operation reported errors')
        if (wire?.success === false) throw new Error('API reported unsuccessful operation')
        const checks = resolveRecipe(hint.assert || {}, ctx.values)
        for (const [path, expected] of Object.entries(checks.equal || {})) assert.deepEqual(at(data, path), expected)
        for (const path of checks.nonempty || []) assert(at(data, path)?.length > 0, 'Empty required output')
        if (checks.vectors) {
          const vectors = at(data, checks.vectors.path)
          assert(Array.isArray(vectors) && vectors.length === checks.vectors.count)
          for (const vector of vectors) assert(Array.isArray(vector) && vector.length === checks.vectors.dimension && vector.every((n: any) => typeof n === 'number' && Number.isFinite(n)), 'Invalid vector shape')
        }
      } }
  })
  const report = await runLiveSteps(steps, { delayMs: liveDelayMs(), report: result => console.log('LIVE STEP ' + JSON.stringify(result)) })
  console.log('LIVE SUMMARY ' + JSON.stringify(report))
  assertLiveReport(report)
  return report
}

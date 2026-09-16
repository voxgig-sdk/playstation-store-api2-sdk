import { cmp, File, Content, entityCollection, envName, serverVariables, serverVarEnv } from '@voxgig/sdkgen'
import { nom } from '@voxgig/apidef'

const TestLive = cmp(function TestLive(props: any) {
  const model = props.ctx$.model
  const plan: any[] = []
  for (const entity of Object.values(entityCollection(model)) as any[]) {
    if (entity.active === false) continue
    for (const [op, operation] of Object.entries(entity.op || {}) as any[]) {
      for (const point of operation.points || []) {
        const facts = point.contract ? JSON.parse(point.contract.json) : {}
        if (model.main.kit.info?.auth === false) facts.security = []
        const same = operation.points.filter((p: any) => JSON.stringify(p.select || {}) === JSON.stringify(point.select || {}))
        plan.push({ entity: entity.name, accessor: nom(entity, 'Name'), op,
          id: point.contract?.id || point.method + ' ' + point.orig, contractVersion: point.contract?.version, kind: point.kind, graphql: point.graphql, path: point.orig, method: point.method,
          action: point.select?.$action, rename: point.rename, args: point.args, facts, reachable: same.length === 1 })
      }
    }
  }
  if (!plan.some(p => p.facts.live)) return
  const server = serverVariables(model).map((v: any) => JSON.stringify(v.name) + ': process.env[' + JSON.stringify(serverVarEnv(envName(model), v.name)) + '] ?? ' + JSON.stringify(v.dflt)).join(', ')
  File({ name: 'live.test.ts' }, () => Content(`import { test } from 'node:test'
import { SDK } from '..'
import { runLiveScenarios } from './live-scenarios'
import { loadEnvLocal } from './utility'
loadEnvLocal(__dirname + '/../.env.local')
test('live operation coverage', { skip: process.env.${envName(model)}_TEST_LIVE !== 'TRUE' }, async () => {
  await runLiveScenarios(SDK, ${JSON.stringify(plan, null, 2)}, '${envName(model)}', { server: { ${server} }, secret: process.env.${envName(model)}_SECRET })
})
`))
})
export { TestLive }

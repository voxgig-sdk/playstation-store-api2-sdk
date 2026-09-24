import assert from 'node:assert/strict'
import { requestContract, synthesizeInput } from './live-contract'
import { runLiveSteps, assertLiveReport, LiveBlocked } from './live-runner'
import { isControlSkipped, liveDelayMs } from './utility'

// The offline flow keeps its deterministic fixture assertions. Live flows
// resolve real prerequisites per operation and collect failures until done.
async function runLiveEntity(setup: any, entity: any, flow: any, accessor: string, facts: any = {}) {
  const { client, transport } = setup
  const steps: any[] = (flow.step || []).filter((step: any) => false !== step.a)
  const created = new Map<string, any>()
  const listed: any[] = []
  const marks = new Map<string, { name: string, value: any }>()
  const idField = entity.id?.field || 'id'
  const copy = (value: any) => JSON.parse(JSON.stringify(value ?? {}))
  const hasCreate = steps.some(step => step.o === 'create')
  const report = await runLiveSteps(steps.map((step, index) => {
    const ref = step.i?.ref || entity.name + '_ref01'
    const op = step.o
    const excluded = isControlSkipped('entityOp', entity.name + '.' + op, 'live')
    return {
      id: entity.name + '.' + op + '.' + index,
      cleanup: op === 'remove' || (step.v || []).some((v: any) => v.apply === 'ItemNotExists'),
      excluded: excluded.skip ? excluded.reason || 'Excluded by test control' : undefined,
      run: async (context: any) => {
        transport.enter(context)
        const points = (entity.op?.[op]?.points || []).filter((point: any) => false !== point.a)
        if (!points.length) throw new LiveBlocked('No modelled operation point')
        const record = created.get(ref)
        // A failed create must not turn a later update/remove into a write
        // against an arbitrary record found by a list operation.
        if ((op === 'update' || op === 'remove') && hasCreate && !record) {
          throw new LiveBlocked('Create did not provide a usable resource')
        }
        if (op === 'remove' && !record) throw new LiveBlocked('No resource created by this run')
        if (op === 'remove' && !entity.id) throw new LiveBlocked('No modelled resource identity for cleanup')
        if (record && ['update', 'remove'].includes(op) && entity.id &&
            null == (record[idField] ?? record.id)) {
          throw new LiveBlocked('Created resource has no usable identity')
        }

        let input: any = op === 'create'
          ? copy(setup.data.new?.[entity.name]?.[ref]) : {}
        for (const [name, binding] of Object.entries({ ...step.m, ...step.d })) {
          const value = setup.idmap[binding as string] ?? setup.idmap[name]
          if (undefined !== value) input[name] = value
        }
        const loaded = record || (op === 'load' ? listed[0] : undefined)
        if (loaded && ['load', 'update', 'remove'].includes(op)) {
          const id = loaded[idField] ?? loaded.id
          if (undefined !== id) input.id = id
        }
        // A nested route needing a parent id must not hide an available
        // parameter-free route for the same operation. Use the first viable
        // candidate; the SDK still performs its normal route selection.
        let resolved: any
        let selected: any
        const missing = new Set<string>()
        for (const point of points) {
          if (point.q?.$action !== input.$action) continue
          const candidate = { ...input }
          let viable = true
          const params = point.g?.params || []
          const query = (point.g?.query || []).filter((arg: any) => arg.r)
          for (const arg of [...params, ...query]) {
            if (undefined !== candidate[arg.n] && null !== candidate[arg.n]) continue
            const key = arg.n === 'id' ? entity.name + '01' : arg.n.replace(/_id$/, '') + '01'
            const value = setup.idmap[key] ?? setup.idmap[arg.n] ?? loaded?.[arg.n] ?? arg.ex
            if (undefined !== value && null !== value) candidate[arg.n] = value
            else if (arg.r !== false) { viable = false; missing.add(arg.n) }
          }
          if (viable) { resolved = candidate; selected = point; break }
        }
        if (!resolved) throw new LiveBlocked('No usable route; missing arguments: ' + [...missing].join(', '))
        input = resolved
        if (op === 'create' && facts[selected.m + ' ' + selected.o]) {
          const selectedFacts = facts[selected.m + ' ' + selected.o]
          const request = requestContract(selectedFacts)
          if (request.schema) input = { ...synthesizeInput(request.schema, selected.li?.input ?? request.example) }
          else if (selectedFacts.protocol === 'http') input = {}
          for (const arg of selected.g?.params || []) if (resolved[arg.n] !== undefined) input[arg.n] = resolved[arg.n]
        }
        let intendedMark: { name: string, value: any } | undefined
        if (op === 'update') {
          for (const spec of step.s || []) {
            if (spec.apply === 'TextFieldMark' && step.i?.textfield) {
              const mark = { name: step.i.textfield, value: spec.def.mark + '_' + setup.now }
              input[mark.name] = mark.value
              intendedMark = mark
            }
          }
        }

        // A fresh entity prevents state left by a failed operation from
        // changing the request for the next independent operation.
        const result = await client[accessor]()[op](input)
        if (intendedMark) marks.set(ref, intendedMark)
        if (op === 'list') {
          assert(Array.isArray(result), 'Expected a list of entity instances')
          const data = result.map((item: any) => {
            assert.equal(typeof item?.data, 'function')
            return item.data()
          })
          listed.splice(0, listed.length, ...data)
          context.publish(data)
          for (const validation of step.v || []) {
            const previous = created.get(validation.def?.ref)
            const id = previous?.[idField] ?? previous?.id
            if (undefined === id) continue
            const found = data.some((item: any) => (item?.[idField] ?? item?.id) === id)
            if (validation.apply === 'ItemExists') assert(found, 'Created resource missing from list')
            if (validation.apply === 'ItemNotExists') assert(!found, 'Removed resource still in list')
          }
        }
        else {
          assert.equal(typeof result?.data, 'function', 'Expected an entity instance')
          const data = result.data()
          assert(null != data, 'Expected operation data')
          // Publish before assertion checks: cleanup still needs the id
          // when the server created a resource with incorrect field values.
          if (op === 'create') created.set(ref, data)
          context.publish(data)
          if (op === 'create' && entity.id) assert(null != (data[idField] ?? data.id), 'Missing created identity')
          if (['load', 'update'].includes(op) && input.id != null && entity.id) {
            assert.equal(data[idField] ?? data.id, input.id, 'Response identity mismatch')
          }
          const mark = marks.get(ref)
          if (mark && ['update', 'load'].includes(op)) {
            assert.equal(data[mark.name], mark.value, 'Updated field mismatch')
          }
        }
      },
    }
  }), {
    delayMs: liveDelayMs(),
    report: result => console.log('LIVE STEP ' + JSON.stringify(result)),
  })
  console.log('LIVE SUMMARY ' + JSON.stringify({ entity: entity.name, ...report }))
  assertLiveReport(report)
}

export { runLiveEntity }

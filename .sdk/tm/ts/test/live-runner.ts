// Execute every independent live step before deciding the suite's result.
// Values never appear in reports: they can contain credentials or API data.

type LiveState = 'passed' | 'failed' | 'blocked' | 'excluded'

type LiveResult = {
  id: string
  state: LiveState
  attempted: boolean
  role?: string
  retention?: string
  reason?: string
  requests?: { method: string, path: string, status?: number }[]
}

type LiveContext = {
  values: Map<string, any>
  publish(value: any): void
  attempted(): void
  requests: { method: string, path: string, status?: number }[]
}

type LiveStep = {
  id: string
  needs?: string[]
  cleanup?: boolean
  role?: string
  retention?: string
  excluded?: string
  run(ctx: LiveContext): Promise<void>
}

class LiveBlocked extends Error {}

type LiveReport = {
  planned: number
  attempted: number
  passed: number
  failed: number
  blocked: number
  excluded: number
  results: LiveResult[]
}

async function runLiveSteps(
  steps: LiveStep[],
  options: { delayMs?: number, report?: (result: LiveResult) => void } = {},
): Promise<LiveReport> {
  const values = new Map<string, any>()
  const results: LiveResult[] = []
  const ids = new Set<string>()
  for (const step of steps) {
    if (!step.id || ids.has(step.id)) throw new Error('Duplicate or empty live step id')
    ids.add(step.id)
  }

  const record = (result: LiveResult) => {
    const step = steps.find(step => step.id === result.id)
    if (step?.role) result.role = step.role
    if (step?.retention && result.attempted) result.retention = step.retention
    results.push(result)
    options.report?.(result)
  }

  // Cleanup runs after ordinary work, even if an assertion failed after a
  // resource was created. A step publishes usable data before assertions.
  for (const cleanup of [false, true]) {
    const pending = steps.filter(step => !!step.cleanup === cleanup)
    while (pending.length) {
      let progressed = false
      for (let i = 0; i < pending.length;) {
        const step = pending[i]
        const missing = (step.needs || []).filter(id => !values.has(id) ||
          (!cleanup && results.some(result => result.id === id && result.state !== 'passed')))
        if (!step.excluded && missing.some(id => pending.some(other => other.id === id))) {
          i++
          continue
        }
        pending.splice(i, 1)
        progressed = true
        if (step.excluded) {
          record({ id: step.id, state: 'excluded', attempted: false, reason: step.excluded })
          continue
        }
        if (missing.length) {
          record({ id: step.id, state: 'blocked', attempted: false,
            reason: 'Missing output: ' + missing.join(', ') })
          continue
        }
        let attempted = false
        const requests: LiveContext['requests'] = []
        try {
          await step.run({
            values,
            publish: value => { if (undefined !== value) values.set(step.id, value) },
            attempted: () => { attempted = true },
            requests,
          })
          if (!attempted) throw new LiveBlocked('No request attempted')
          record({ id: step.id, state: 'passed', attempted, requests })
        }
        catch (error) {
          // Ordinary SDK errors can contain request headers, bodies, or an
          // issued token. Report the step's failure without serializing it.
          record({ id: step.id, state: error instanceof LiveBlocked ? 'blocked' : 'failed',
            attempted, requests,
            reason: error instanceof LiveBlocked ? error.message : 'Request or assertion failed' })
        }
        if (attempted && (options.delayMs || 0) > 0) {
          await new Promise(resolve => setTimeout(resolve, options.delayMs))
        }
      }
      if (!progressed) {
        for (const step of pending.splice(0)) {
          record({ id: step.id, state: 'blocked', attempted: false,
            reason: 'Cyclic or unavailable dependency' })
        }
      }
    }
  }

  return {
    planned: steps.length,
    attempted: results.filter(result => result.attempted).length,
    passed: results.filter(result => result.state === 'passed').length,
    failed: results.filter(result => result.state === 'failed').length,
    blocked: results.filter(result => result.state === 'blocked').length,
    excluded: results.filter(result => result.state === 'excluded').length,
    results,
  }
}

function assertLiveReport(report: LiveReport): void {
  if (report.failed || report.blocked || !report.attempted) {
    throw new Error('Live coverage incomplete: ' + JSON.stringify(report))
  }
}

function createLiveTransport(timeoutMs = 30000) {
  let context: LiveContext | undefined
  const requests: LiveContext['requests'] = []
  const nativeFetch = globalThis.fetch
  return {
    requests,
    enter(next: LiveContext) { context = next },
    fetch: async (input: any, init?: any) => {
      const url = new URL(String(input))
      const request: LiveContext['requests'][number] = {
        method: init?.method || 'GET', path: url.origin + url.pathname,
      }
      requests.push(request)
      context?.requests.push(request)
      context?.attempted()
      if (!context) console.log('LIVE REQUEST ' + JSON.stringify(request))
      const timeout = AbortSignal.timeout(timeoutMs)
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
      const response = await nativeFetch(input, { ...init, signal })
      request.status = response.status
      if (!context) console.log('LIVE RESPONSE ' + JSON.stringify(request))
      return response
    },
  }
}

export { runLiveSteps, assertLiveReport, LiveBlocked, createLiveTransport }
export type { LiveStep, LiveContext, LiveReport, LiveResult }

// Smoke tests for the vendored omni runner itself: a runner that cannot
// FAIL a bad entry would turn every corpus suite vacuously green, so pin
// the failure paths, not just the happy one.

import { test, describe } from 'node:test'
import assert from 'node:assert'

import { SDK } from '..'

import { OmniError, makeRunner } from './omni'


// A minimal in-memory spec: no fixture file, no OMNI block (lenient v0,
// like the shared corpus).
const SPEC = {
  primary: {
    smoke: {
      basic: {
        set: [
          { in: 1, out: 2 },
          { in: 41, out: 42 },
        ],
      },
      bad: {
        set: [
          { in: 1, out: 999 },
        ],
      },
      err: {
        set: [
          { in: 0, err: 'zero refused' },
        ],
      },
    },
  },
}

const inc = (n: number) => {
  if (0 === n) {
    throw new Error('smoke: zero refused')
  }
  return n + 1
}


describe('omni', () => {

  test('runset passes a correct subject', async () => {
    const runner = await makeRunner(SPEC, SDK.test())
    const R: any = await runner('smoke')
    await R.runset(R.spec.basic, inc)
  })


  test('runset FAILS a wrong result, with OmniError', async () => {
    const runner = await makeRunner(SPEC, SDK.test())
    const R: any = await runner('smoke')
    await assert.rejects(
      () => R.runset(R.spec.bad, inc),
      (err: any) => {
        assert.equal(err.name, 'OmniError')
        assert.ok(err instanceof OmniError)
        assert.match(err.message, /result mismatch/)
        return true
      })
  })


  test('an expected error is matched, an unexpected one fails', async () => {
    const runner = await makeRunner(SPEC, SDK.test())
    const R: any = await runner('smoke')

    await R.runset(R.spec.err, inc)

    await assert.rejects(
      () => R.runset(R.spec.err, (n: number) => n),
      (err: any) => {
        assert.equal(err.name, 'OmniError')
        assert.match(err.message, /expected error did not occur/)
        return true
      })
  })

})

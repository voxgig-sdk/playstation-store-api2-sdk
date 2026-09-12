

import Path from 'node:path'
import * as Fs from 'node:fs'

import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert'


import { ProjectNameSDK, BaseFeature, stdutil } from '../../..'

import {
  envOverride,
  liveClientOptions,
  liveDelay,
  loadEnvLocal,
  makeCtrl,
  makeMatch,
  makeReqdata,
  makeStepData,
  makeValid,
  maybeSkipControl,
} from '../../utility'


// AFTER the imports on purpose: TypeScript hoists `import` above any
// statement in the emitted CommonJS, so a loader placed above them would
// run only after every imported module had already been evaluated - and
// anything reading process.env at module scope would miss these values.
loadEnvLocal(__dirname + '/../../../.env.local')


describe('EntityNameEntity', async () => {

  // Per-test live pacing. Delay is read from sdk-test-control.json's
  // `test.live.delayMs`; only sleeps when PROJECTENV_TEST_LIVE=TRUE.
  afterEach(liveDelay('PROJECTENV_TEST_LIVE'))

  test('instance', async () => {
    const testsdk = ProjectNameSDK.test()
    const ent = testsdk.EntityName()
    assert(null != ent)
  })


  test('basic', async (t) => {
    // <[SLOT:basic]>
  })
})


// <[SLOT:basicSetup]>

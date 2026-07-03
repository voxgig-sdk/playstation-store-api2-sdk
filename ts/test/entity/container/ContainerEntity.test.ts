
const envlocal = __dirname + '/../../../.env.local'
require('dotenv').config({ quiet: true, path: [envlocal] })

import Path from 'node:path'
import * as Fs from 'node:fs'

import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert'


import { PlaystationStoreApi2SDK, BaseFeature, stdutil } from '../../..'

import {
  envOverride,
  liveDelay,
  makeCtrl,
  makeMatch,
  makeReqdata,
  makeStepData,
  makeValid,
  maybeSkipControl,
} from '../../utility'


describe('ContainerEntity', async () => {

  // Per-test live pacing. Delay is read from sdk-test-control.json's
  // `test.live.delayMs`; only sleeps when PLAYSTATIONSTOREAPI2_TEST_LIVE=TRUE.
  afterEach(liveDelay('PLAYSTATIONSTOREAPI2_TEST_LIVE'))

  test('instance', async () => {
    const testsdk = PlaystationStoreApi2SDK.test()
    const ent = testsdk.Container()
    assert(null != ent)
  })


  test('basic', async (t) => {

    const live = 'TRUE' === process.env.PLAYSTATION_STORE_API__TEST_LIVE
    for (const op of ['list']) {
      if (maybeSkipControl(t, 'entityOp', 'container.' + op, live)) return
    }

    const setup = basicSetup()
    // The basic flow consumes synthetic IDs and field values from the
    // fixture (entity TestData.json). Those don't exist on the live API.
    // Skip live runs unless the user provided a real ENTID env override.
    if (setup.syntheticOnly) {
      t.skip('live entity test uses synthetic IDs from fixture — set PLAYSTATION_STORE_API__TEST_CONTAINER_ENTID JSON to run live')
      return
    }
    const client = setup.client
    const struct = setup.struct

    const isempty = struct.isempty
    const select = struct.select

    let container_ref01_data = Object.values(setup.data.existing.container)[0] as any

    // LIST
    const container_ref01_ent = client.Container()
    const container_ref01_match: any = {}
    container_ref01_match['age_limit'] = setup.idmap['age_limit01']
    container_ref01_match['container_id'] = setup.idmap['container01']
    container_ref01_match['country'] = setup.idmap['country01']
    container_ref01_match['language'] = setup.idmap['language01']

    const container_ref01_list = await container_ref01_ent.list(container_ref01_match)


  })
})



function basicSetup(extra?: any) {
  // TODO: fix test def options
  const options: any = {} // null

  // TODO: needs test utility to resolve path
  const entityDataFile =
    Path.resolve(__dirname, 
      '../../../../.sdk/test/entity/container/ContainerTestData.json')

  // TODO: file ready util needed?
  const entityDataSource = Fs.readFileSync(entityDataFile).toString('utf8')

  // TODO: need a xlang JSON parse utility in voxgig/struct with better error msgs
  const entityData = JSON.parse(entityDataSource)

  options.entity = entityData.existing

  let client = PlaystationStoreApi2SDK.test(options, extra)
  const struct = client.utility().struct
  const merge = struct.merge
  const transform = struct.transform

  let idmap = transform(
    ['container01','container02','container03','container01','container02','container03'],
    {
      '`$PACK`': ['', {
        '`$KEY`': '`$COPY`',
        '`$VAL`': ['`$FORMAT`', 'upper', '`$COPY`']
      }]
    })

  // Detect whether the user provided a real ENTID JSON via env var. The
  // basic flow consumes synthetic IDs from the fixture file; without an
  // override those synthetic IDs reach the live API and 4xx. Surface this
  // to the test so it can skip rather than fail.
  const idmapEnvVal = process.env['PLAYSTATION_STORE_API__TEST_CONTAINER_ENTID']
  const idmapOverridden = null != idmapEnvVal && idmapEnvVal.trim().startsWith('{')

  const env = envOverride({
    'PLAYSTATION_STORE_API__TEST_CONTAINER_ENTID': idmap,
    'PLAYSTATION_STORE_API__TEST_LIVE': 'FALSE',
    'PLAYSTATION_STORE_API__TEST_EXPLAIN': 'FALSE',
    'PLAYSTATION_STORE_API__APIKEY': 'NONE',
  })

  idmap = env['PLAYSTATION_STORE_API__TEST_CONTAINER_ENTID']

  const live = 'TRUE' === env.PLAYSTATION_STORE_API__TEST_LIVE

  if (live) {
    client = new PlaystationStoreApi2SDK(merge([
      {
        apikey: env.PLAYSTATION_STORE_API__APIKEY,
      },
      extra
    ]))
  }

  const setup = {
    idmap,
    env,
    options,
    client,
    struct,
    data: entityData,
    explain: 'TRUE' === env.PLAYSTATION_STORE_API__TEST_EXPLAIN,
    live,
    syntheticOnly: live && !idmapOverridden,
    now: Date.now(),
  }

  return setup
}
  

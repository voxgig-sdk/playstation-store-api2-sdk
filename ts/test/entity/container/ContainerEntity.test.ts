

import Path from 'node:path'
import * as Fs from 'node:fs'

import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert'
import { createLiveTransport } from '../../live-runner'
import { runLiveEntity } from '../../live-entity'


import { PlaystationStoreApi2SDK, BaseFeature, stdutil } from '../../..'

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


loadEnvLocal(__dirname + '/../../../.env.local')


describe('ContainerEntity', async () => {

  // Per-test live pacing. Delay is read from sdk-test-control.json's
  // `test.live.delayMs`; only sleeps when PLAYSTATION_STORE_API2_TEST_LIVE=TRUE.
  afterEach(liveDelay('PLAYSTATION_STORE_API2_TEST_LIVE'))

  test('instance', async () => {
    const testsdk = PlaystationStoreApi2SDK.test()
    const ent = testsdk.Container()
    assert(null != ent)
  })


  test('basic', async (t) => {

    const live = 'TRUE' === process.env.PLAYSTATION_STORE_API2_TEST_LIVE
    for (const op of ['load']) {
      if (!live && maybeSkipControl(t, 'entityOp', 'container.' + op, live)) return
    }

    
    const setup = basicSetup()
    if (setup.live) {
      return runLiveEntity(setup, {"active":true,"alias":{"field":{}},"fields":{"age_limit":{"a":true,"h":"Age Limit","n":"age_limit","r":false,"sh":"Age limit for the content","t":"`$INTEGER`","key$":"age_limit","index$":0},"attributes":{"a":true,"h":"Attributes","n":"attributes","r":false,"t":"`$OBJECT`","key$":"attributes","index$":1},"container_type":{"a":true,"h":"Container Type","n":"container_type","r":false,"sh":"Type of container","t":"`$STRING`","key$":"container_type","index$":2},"content_origin":{"a":true,"h":"Content Origin","n":"content_origin","r":false,"sh":"Content origin identifier","t":"`$INTEGER`","key$":"content_origin","index$":3},"dob_required":{"a":true,"h":"Dob Required","n":"dob_required","r":false,"sh":"Whether date of birth is required","t":"`$BOOLEAN`","key$":"dob_required","index$":4},"id":{"a":true,"h":"Id","n":"id","r":false,"sh":"Container unique identifier","t":"`$STRING`","key$":"id","index$":5},"images":{"a":true,"h":"Images","n":"images","r":false,"t":"`$ARRAY`","key$":"images","index$":6},"links":{"a":true,"h":"Links","n":"links","r":false,"sh":"List of products in the container","t":"`$ARRAY`","key$":"links","index$":7}},"id":{"field":"id","from":{"age_limit":"age_limit"},"name":"id","parts":["country","language","age_limit","container_id"],"sep":"/"},"name":"container","op":{"load":{"input":"data","name":"load","points":[{"a":true,"co":{"id":"GET /container/{country}/{language}/{age_limit}/{container_id}","source":"openapi3","version":2},"g":{"params":[{"a":true,"ex":"999","k":"param","n":"age_limit","or":"age_limit","r":true,"t":"`$STRING`","index$":0},{"a":true,"ex":"STORE-MSF75508-FULLGAMES","k":"param","n":"container_id","or":"container_id","r":true,"t":"`$STRING`","index$":1},{"a":true,"ex":"ch","k":"param","n":"country","or":"country","r":true,"t":"`$STRING`","index$":2},{"a":true,"ex":"de","k":"param","n":"language","or":"language","r":true,"t":"`$STRING`","index$":3}],"query":[{"a":true,"k":"query","n":"game_content_type","or":"game_content_type","r":false,"t":"`$STRING`","index$":0},{"a":true,"k":"query","n":"genre","or":"genre","r":false,"t":"`$STRING`","index$":1},{"a":true,"k":"query","n":"platform","or":"platform","r":false,"t":"`$STRING`","index$":2},{"a":true,"k":"query","n":"price","or":"price","r":false,"t":"`$STRING`","index$":3},{"a":true,"k":"query","n":"release_date","or":"release_date","r":false,"t":"`$STRING`","index$":4},{"a":true,"ex":20,"k":"query","n":"size","or":"size","r":false,"t":"`$INTEGER`","index$":5},{"a":true,"ex":"release_date","k":"query","n":"sort","or":"sort","r":false,"t":"`$STRING`","index$":6},{"a":true,"ex":0,"k":"query","n":"start","or":"start","r":false,"t":"`$INTEGER`","index$":7}]},"k":"http","m":"GET","o":"/container/{country}/{language}/{age_limit}/{container_id}","q":{"exist":["age_limit","container_id","country","game_content_type","genre","language","platform","price","release_date","size","sort","start"]},"r":{},"s":[{"lit":"container"},{"var":"country"},{"var":"language"},{"var":"age_limit"},{"var":"container_id"}],"t":{"req":"`reqdata`","res":"`body`"},"index$":0}],"key$":"load"}},"relations":{"ancestors":[]},"key$":"container","name__orig":"container","Name":"Container","name_":"container","name-":"container","NAME":"CONTAINER","index$":0}, {"active":true,"entity":"container","key$":"BasicContainerFlow","kind":"basic","name":"BasicContainerFlow","param":{},"step":[{"a":true,"d":{},"i":{"ref":"container_ref01","srcdatavar":"container_ref01_data","suffix":"_dt0"},"m":{"age_limit":"age_limit01","country":"country01","id":"container01","language":"language01"},"o":"load","s":[],"v":[{"apply":"TextFieldMark","def":{"mark":"Mark01-container_ref01"}}],"index$":0}]}, 'Container', {"GET /container/{country}/{language}/{age_limit}/{container_id}":{"protocol":"http","operationId":"getContainer","responses":{"200":{"description":"Successful response with container content","content":{"application/json":{"schema":{"type":"object","properties":{"age_limit":{"type":"integer","description":"Age limit for the content","key$":"age_limit"},"attributes":{"type":"object","properties":{"facets":{"type":"object","properties":{"game_content_type":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"subtitle_lang":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"release_date":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"game_demo":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"price":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"genre":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"top_category":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"voice_lang":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"game_type":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"relationship":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}},"platform":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Display name of the facet"},"count":{"type":"integer","description":"Number of items matching this facet"},"key":{"type":"string","description":"Unique key for the facet"}},"x-ref":"#/components/schemas/Facet"}}},"x-ref":"#/components/schemas/Facets"},"next":{"type":"array","items":{"type":"string"},"description":"Next page token for pagination"}},"key$":"attributes"},"container_type":{"type":"string","description":"Type of container","key$":"container_type"},"content_origin":{"type":"integer","description":"Content origin identifier","key$":"content_origin"},"dob_required":{"type":"boolean","description":"Whether date of birth is required","key$":"dob_required"},"id":{"type":"string","description":"Container unique identifier","key$":"id"},"images":{"type":"array","items":{"type":"object","properties":{"type":{"type":"integer","description":"Image type identifier"},"url":{"type":"string","format":"uri","description":"Image URL"}},"x-ref":"#/components/schemas/Image"},"key$":"images"},"links":{"type":"array","items":{"type":"object","properties":{"bucket":{"type":"string","description":"Product bucket category"},"container_type":{"type":"string","description":"Type of container"},"content_type":{"type":"string","description":"Content type identifier"},"default_sku":{"type":"object","properties":{"id":{"type":"string","description":"SKU unique identifier"},"name":{"type":"string","description":"SKU name"},"display_price":{"type":"string","description":"Formatted display price"},"price":{"type":"integer","description":"Price in smallest currency unit (e.g., cents)"},"type":{"type":"string","description":"SKU type"},"sku_type":{"type":"integer","description":"SKU type identifier"},"platforms":{"type":"array","items":{"type":"integer"},"description":"Platform identifiers"},"defaultSku":{"type":"boolean","description":"Whether this is the default SKU"},"amortizeFlag":{"type":"boolean","description":"Amortization flag"},"bundleExclusiveFlag":{"type":"boolean","description":"Bundle exclusive flag"},"chargeImmediatelyFlag":{"type":"boolean","description":"Charge immediately flag"},"charge_type_id":{"type":"integer","description":"Charge type identifier"},"credit_card_required_flag":{"type":"integer","description":"Credit card required flag"},"is_original":{"type":"boolean","description":"Whether this is the original SKU"},"offerOnlyFlag":{"type":"boolean","description":"Offer only flag"},"seasonPassExclusiveFlag":{"type":"boolean","description":"Season pass exclusive flag"},"skuAvailabilityOverrideFlag":{"type":"boolean","description":"SKU availability override flag"},"eligibilities":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Eligibility identifier"},"name":{"type":"string","description":"Eligibility name"},"description":{"type":"string","description":"Eligibility description"},"operand":{"type":"string","description":"Operand for eligibility check"},"operator":{"type":"string","description":"Operator for eligibility check"},"rightOperand":{"type":"string","nullable":true,"description":"Right operand for eligibility check"},"unionIndex":{"type":"integer","nullable":true,"description":"Union index"},"entitlement_type":{"type":"string","nullable":true,"description":"Entitlement type"},"drms":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"libraryPath":{"type":"string"}}}}},"x-ref":"#/components/schemas/Eligibility"}},"entitlements":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Entitlement identifier"},"name":{"type":"string","description":"Entitlement name"},"description":{"type":"string","nullable":true,"description":"Entitlement description"},"type":{"type":"integer","description":"Entitlement type"},"license_type":{"type":"integer","description":"License type"},"size":{"type":"integer","description":"Size in bytes"},"subType":{"type":"integer","description":"Entitlement subtype"},"feature_type_id":{"type":"integer","description":"Feature type identifier"},"duration":{"type":"integer","description":"Duration"},"exp_after_first_use":{"type":"integer","description":"Expiration after first use"},"use_count":{"type":"integer","description":"Use count"},"preorder_placeholder_flag":{"type":"boolean","description":"Preorder placeholder flag"},"drms":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"DRM identifier"},"type":{"type":"integer","description":"DRM type"},"drm_category_type":{"type":"integer","description":"DRM category type"},"size":{"type":"integer","description":"Size in bytes"},"is_streamable":{"type":"integer","description":"Whether content is streamable"},"media_prop":{"type":"object","description":"Media properties"}},"x-ref":"#/components/schemas/DRM"}},"packages":{"type":"array","items":{"type":"object"}},"metadata":{"type":"object","nullable":true},"packageType":{"type":"string","nullable":true},"durationOverrideTypeId":{"type":"integer","nullable":true},"subtitle_language_codes":{"type":"array","nullable":true,"items":{"type":"string"}},"voice_language_codes":{"type":"array","nullable":true,"items":{"type":"string"}}},"x-ref":"#/components/schemas/Entitlement"}},"rewards":{"type":"array","items":{"type":"object"}}},"x-ref":"#/components/schemas/SKU"},"gameContentTypesList":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"key":{"type":"string"}}}},"game_contentType":{"type":"string","description":"Game content type"},"id":{"type":"string","description":"Product unique identifier"},"images":{"type":"array","items":{"type":"object","properties":{"type":{"type":"integer","description":"Image type identifier"},"url":{"type":"string","format":"uri","description":"Image URL"}},"x-ref":"#/components/schemas/Image"}},"name":{"type":"string","description":"Product name"},"playable_platform":{"type":"array","items":{"type":"string"},"description":"Platforms where the product can be played"},"provider_name":{"type":"string","description":"Name of the content provider"},"release_date":{"type":"string","format":"date-time","description":"Release date in ISO 8601 format"},"restricted":{"type":"boolean","description":"Whether the product has restrictions"},"revision":{"type":"integer","description":"Product revision number"},"short_name":{"type":"string","description":"Short name of the product"},"timestamp":{"type":"integer","format":"int64","description":"Unix timestamp in milliseconds"},"top_category":{"type":"string","description":"Top category classification"},"url":{"type":"string","format":"uri","description":"URL to product details"},"cloud_only_platform":{"type":"array","items":{"type":"string"},"description":"Cloud-only platforms"}},"x-ref":"#/components/schemas/Product"},"description":"List of products in the container","key$":"links"}},"x-ref":"#/components/schemas/ContainerResponse","index$":0}}}},"400":{"description":"Bad request - Invalid parameters","content":{"application/json":{"schema":{"type":"object","properties":{"error":{"type":"string","description":"Error message"},"code":{"type":"string","description":"Error code"},"message":{"type":"string","description":"Detailed error message"}},"x-ref":"#/components/schemas/Error"}}}},"404":{"description":"Container not found","content":{"application/json":{"schema":{"type":"object","properties":{"error":{"type":"string","description":"Error message"},"code":{"type":"string","description":"Error code"},"message":{"type":"string","description":"Detailed error message"}},"x-ref":"#/components/schemas/Error"}}}},"500":{"description":"Internal server error","content":{"application/json":{"schema":{"type":"object","properties":{"error":{"type":"string","description":"Error message"},"code":{"type":"string","description":"Error code"},"message":{"type":"string","description":"Detailed error message"}},"x-ref":"#/components/schemas/Error"}}}}},"parameters":[{"name":"country","in":"path","description":"Country code (e.g., 'ch' for Switzerland)","required":true,"schema":{"type":"string","example":"ch"},"index$":0},{"name":"language","in":"path","description":"Language code (e.g., 'de' for German)","required":true,"schema":{"type":"string","example":"de"},"index$":1},{"name":"age_limit","in":"path","description":"Age limit for content filtering","required":true,"schema":{"type":"string","example":"999"},"index$":2},{"name":"container_id","in":"path","description":"Container identifier (e.g., 'STORE-MSF75508-FULLGAMES' for full games)","required":true,"schema":{"type":"string","example":"STORE-MSF75508-FULLGAMES"},"index$":3},{"name":"size","in":"query","description":"Number of items to return per page","required":false,"schema":{"type":"integer","default":20,"minimum":1,"maximum":100},"index$":4},{"name":"start","in":"query","description":"Offset for pagination (starting index)","required":false,"schema":{"type":"integer","default":0,"minimum":0},"index$":5},{"name":"sort","in":"query","description":"Sort order for results","required":false,"schema":{"type":"string","enum":["release_date","name","price"],"default":"release_date"},"index$":6},{"name":"platform","in":"query","description":"Filter by platform (ps4, ps5, ps3, vita, psp)","required":false,"schema":{"type":"string","enum":["ps4","ps5","ps3","vita","psp"]},"index$":7},{"name":"price","in":"query","description":"Filter by price range","required":false,"schema":{"type":"string","enum":["0-249","250-499","500-999","1000-1999","2000-2999","3000-3999","4000-4999","5000-5999","6000-7999","8000-*"]},"index$":8},{"name":"genre","in":"query","description":"Filter by game genre","required":false,"schema":{"type":"string","enum":["action","adventure","arcade","racing","shooter","sports","rpg","puzzle","strategy","simulation"]},"index$":9},{"name":"game_content_type","in":"query","description":"Filter by game content type","required":false,"schema":{"type":"string","enum":["bundles","games","timed_trials"]},"index$":10},{"name":"release_date","in":"query","description":"Filter by release date range","required":false,"schema":{"type":"string","enum":["coming_soon","last_7_days","last_30_days"]},"index$":11}],"securitySource":"unspecified"}})
    }
    const client = setup.client
    const struct = setup.struct

    const isempty = struct.isempty
    const select = struct.select

    let container_ref01_data = Object.values(setup.data.existing.container)[0] as any

    // LOAD
    const container_ref01_ent = client.Container()
    const container_ref01_match_dt0: any = {}
    container_ref01_match_dt0.id = container_ref01_data.id
    const container_ref01_data_dt0 = (await container_ref01_ent.load(container_ref01_match_dt0)).data()
    assert(container_ref01_data_dt0.id === container_ref01_data.id)


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
    ['container01','container02','container03','age_limit01','country01','language01'],
    {
      '`$PACK`': ['', {
        '`$KEY`': '`$COPY`',
        '`$VAL`': ['`$FORMAT`', 'upper', '`$COPY`']
      }]
    })

  const env = envOverride({
    'PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID': idmap,
    'PLAYSTATION_STORE_API2_TEST_LIVE': 'FALSE',
    'PLAYSTATION_STORE_API2_TEST_EXPLAIN': 'FALSE',
  })

  idmap = env['PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID']

  const live = 'TRUE' === env.PLAYSTATION_STORE_API2_TEST_LIVE

  const transport = createLiveTransport()
  if (live) {
    const rawIds = process.env['PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID']
    idmap = rawIds && rawIds.trim() ? JSON.parse(rawIds) : {}
    if (!idmap || Array.isArray(idmap) || typeof idmap !== 'object') {
      throw new Error('Live ENTID must be a JSON object')
    }
    client = new PlaystationStoreApi2SDK(merge([
      // FIRST, so the generated fields below win: sdk-test-control.json's
      // test.client.options adds to the live client, it does not redirect it.
      liveClientOptions(),
      {
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
    explain: 'TRUE' === env.PLAYSTATION_STORE_API2_TEST_EXPLAIN,
    live,
    transport,
    now: Date.now(),
  }

  return setup
}
  

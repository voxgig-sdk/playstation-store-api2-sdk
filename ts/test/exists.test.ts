
import { test, describe } from 'node:test'
import { equal } from 'node:assert'


import { PlaystationStoreApi2SDK } from '..'


describe('exists', async () => {

  test('test-mode', () => {
    const testsdk = PlaystationStoreApi2SDK.test()
    equal(testsdk instanceof PlaystationStoreApi2SDK, true,
      'PlaystationStoreApi2SDK.test() must return a client synchronously')
  })

})

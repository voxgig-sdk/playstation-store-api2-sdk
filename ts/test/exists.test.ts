
import { test, describe } from 'node:test'
import { equal } from 'node:assert'


import { PlaystationStoreApi2SDK } from '..'


describe('exists', async () => {

  test('test-mode', async () => {
    const testsdk = await PlaystationStoreApi2SDK.test()
    equal(null !== testsdk, true)
  })

})

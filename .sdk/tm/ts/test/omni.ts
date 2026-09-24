
import { isAbsolute, join } from 'node:path'

import {
  EXISTSMARK,
  NULLMARK,
  UNDEFMARK,
  OmniError,
  nullmodifier,
  makeRunner as omnimakerunner,
} from './vendor/omni/index'

import type { Json, Provider, Subject } from './vendor/omni/index'


export type StructSubject = (...args: any[]) => any
export type StructRunSet = (testspec: any, testsubject?: StructSubject) => Promise<void>
export type StructRunSetFlags = (
  testspec: any,
  flags: Record<string, any>,
  testsubject?: StructSubject,
) => Promise<void>

export type StructRunPack = {
  spec: any
  runset: StructRunSet
  runsetflags: StructRunSetFlags
  subject?: StructSubject
  client: StructProvider
}

export type StructRunner = (name: string, store?: any) => Promise<StructRunPack>

// An omni provider that is also the live SDK: test code reaches through the
// runpack's `client` as an SDK (`client.utility().struct`), so alongside the
// omni hooks every SDK member must resolve.
export type StructProvider = Provider & {
  utility: () => any
  tester: (options?: any) => any
  sdk: any
}


function sdkhooks(sdk: any) {
  return {
    subject: (name: string): Subject | undefined => {
      const utility = sdk.utility()
      return utility[name] || (utility.struct && utility.struct[name])
    },

    // A DEF.client entry becomes another SDK instance — rewrapped with the
    // same delegating shape, not a plain hook object.
    client: async (options: Json) => sdkprovider(await sdk.tester(options)),

    contextify: (val: Json): Json => {
      const utility = sdk.utility()
      const hook =
        'function' === typeof utility.contextify ? utility.contextify
          : 'function' === typeof utility.makeContext ? utility.makeContext
            : null
      const ctx = null == hook ? val : hook.call(utility, val)
      if (null != ctx && 'object' === typeof ctx) {
        ; (ctx as any).utility = utility
      }
      return ctx
    },

    inject: (options: Json, store: Json): Json => {
      const structutils = sdk.utility().struct
      if (structutils && 'function' === typeof structutils.inject) {
        return structutils.inject(options, store)
      }
      return options
    },

    utility: () => sdk.utility(),
    tester: (options?: any) => sdk.tester(options),
    sdk,
  }
}


// Wrap the SDK as an omni provider WITHOUT hiding it: hooks from sdkhooks,
// everything else through the prototype chain.
function sdkprovider(sdk: any): StructProvider {
  const provider = Object.assign(Object.create(sdk), sdkhooks(sdk))
  return provider
}


// struct's makeRunner(testfile, client) signature, backed by vendored omni.
// Also accepts an already-parsed spec object (omni's own capability), which
// keeps smoke tests free of fixture files.
async function makeRunner(testfile: string | Json, client: any): Promise<StructRunner> {
  const specref = 'string' !== typeof testfile ? testfile
    : isAbsolute(testfile) ? testfile
      : join(__dirname, testfile)

  const provider = sdkprovider(client)
  const runner = await omnimakerunner(specref, provider)

  return async function structrunner(name: string, store?: any) {
    const runpack = await runner(name, store)

    return {
      spec: runpack.spec,
      runset: runpack.runset,
      runsetflags: runpack.runsetflags,
      subject: runpack.subject,
      client: provider,
    }
  }
}


const nullModifier = nullmodifier


export {
  EXISTSMARK,
  NULLMARK,
  UNDEFMARK,
  OmniError,
  makeRunner,
  nullModifier,
}

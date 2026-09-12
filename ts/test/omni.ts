// The corpus test runner: vendored @voxgig/omni driven through its NATIVE
// API (`makeRunner(specref, provider)`), presented to the corpus tests in
// the struct-runner shape they already use (`R.spec`, `R.runset`,
// `R.runsetflags`, `R.client`). No compat shim is vendored: the adapter
// below IS the whole bridge, per language, per the vendor-tag rollout
// (docs/design/vendor-tag-rollout.md, Decision 4).
//
// Two local decisions, both required:
//
// 1. SPEC PATH. omni's own spec resolution expects the caller to hand it a
//    usable path — its docs say a port must resolve the path itself. This
//    module compiles to dist-test/omni.js, the same depth as the old
//    dist-test/runner.js, so the existing TEST_JSON_FILE constant keeps
//    working verbatim: a relative path is absolutized against __dirname.
//
// 2. PROVIDER DELEGATION. Corpus-driven contexts get `ctx.client` set to
//    the runner's provider (omni overwrites it on any ctx/args map entry).
//    A five-hook provider object HIDES the live SDK from the generated
//    utilities that reach through it — prepareHeaders via client.options(),
//    fetcher via client._mode, the feature helpers via client._rootctx and
//    even ASSIGNING client._features. So the provider here is built by
//    PROTOTYPE DELEGATION over the live SDK instance: every SDK member
//    resolves, while the omni hooks sit on top. (Upstream omni#56 tracks
//    giving the stock provider the same shape.)

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


// The runner API the corpus tests consume — struct's runner shape, name
// for name, served over native omni.
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


// The omni hooks for an SDK subject — what the retired compat shim called
// `structprovider`, inlined here because this resolver is the one consumer.
function sdkhooks(sdk: any) {
  return {
    // A subject is resolved from the utility, or from utility.struct.
    subject: (name: string): Subject | undefined => {
      const utility = sdk.utility()
      return utility[name] || (utility.struct && utility.struct[name])
    },

    // A DEF.client entry becomes another SDK instance — rewrapped with the
    // same delegating shape, not a plain hook object.
    client: async (options: Json) => sdkprovider(await sdk.tester(options)),

    // The SDK supplies its own context wrapper.
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

    // Client options may reference the runner store.
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


// struct's flag-modifier name, served from native omni.
const nullModifier = nullmodifier


export {
  EXISTSMARK,
  NULLMARK,
  UNDEFMARK,
  OmniError,
  makeRunner,
  nullModifier,
}

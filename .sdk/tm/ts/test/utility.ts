/**
 * Shared utility functions for unit tests
 *
 * This module provides common helper functions used across unit tests
 * for creating test data, transformations, validations, and environment overrides.
 */

import * as Fs from 'node:fs'
import * as Path from 'node:path'


// Creates a new step data structure within the data model
function makeStepData(dm: Record<string, any>, stepname: string): Record<string, any> {
  dm.s[stepname] = {
    entity: undefined,
    match: undefined,
    reqdata: undefined,
    resdata: undefined,
  }
  return dm.s[stepname]
}


// Transforms and creates a match object using the provided transform function
function makeMatch(
  dm: Record<string, any>,
  transform: Function,
  match: any
): Record<string, any> {
  return transform({}, match, { meta: { dm } })
}


// Transforms and creates request data using the provided transform function
function makeReqdata(
  dm: Record<string, any>,
  transform: Function,
  data: any
): Record<string, any> {
  return transform({}, data, { meta: { dm } })
}


// Validates data against validation rules and returns the result
function makeValid(
  dm: Record<string, any>,
  validate: Function,
  data: any,
  valid: any
): Record<string, any> {
  valid["`$OPEN`"] = true
  return validate(data, valid, { meta: { '`$EXISTS`': true, dm } })
}


// Creates a control object for test explanations when enabled
function makeCtrl(explain: boolean) {
  return explain ? { explain: {} } : undefined
}
// CLAUDE: add a full stop to each function comment

// Overrides configuration values with environment variables if available
function envOverride(m: Record<string, any>) {
  if (
    'TRUE' === process.env.PROJECTENV_TEST_LIVE ||
    'TRUE' === process.env.PROJECTENV_TEST_OVERRIDE
  ) {
    Object.entries(m).map(n => {
      let envval = process.env[n[0]]
      if (null != envval) {
        envval = envval.trim()
        m[n[0]] = envval.startsWith('{') ? JSON.parse(envval) : envval
      }
    })
  }

  m.PROJECTENV_TEST_EXPLAIN = process.env.PROJECTENV_TEST_EXPLAIN || m.PROJECTENV_TEST_EXPLAIN

  return m
}


// Loads sdk-test-control.json (cached). Returns an empty-skip object if
// the file is missing or unparsable so tests never crash on a bad config.
type TestControl = {
  version?: number
  test?: {
    skip?: {
      live?: { direct?: any[], entityOp?: any[] }
      unit?: { direct?: any[], entityOp?: any[] }
    }
    live?: { delayMs?: number }
    client?: { options?: Record<string, any> }
    [k: string]: any
  }
  [k: string]: any
}

let _testControlCache: TestControl | null = null

function loadTestControl(): TestControl {
  if (_testControlCache) return _testControlCache
  const ctrlPath = Path.resolve(__dirname, '../test/sdk-test-control.json')
  try {
    _testControlCache = JSON.parse(Fs.readFileSync(ctrlPath, 'utf8')) as TestControl
  }
  catch {
    _testControlCache = {
      version: 1,
      test: { skip: { live: { direct: [], entityOp: [] }, unit: { direct: [], entityOp: [] } } }
    }
  }
  return _testControlCache!
}


// Returns the skip decision for a given test name from sdk-test-control.json.
// `kind` is 'direct' (matches by `test` field) or 'entityOp' (matches by
// `entity` + `op`). `mode` is 'live' or 'unit'.
function isControlSkipped(
  kind: 'direct' | 'entityOp',
  name: string,
  mode: 'live' | 'unit'
): { skip: boolean, reason?: string } {
  const ctrl = loadTestControl()
  const list = ctrl?.test?.skip?.[mode]?.[kind] ?? []
  for (const e of list) {
    if (kind === 'direct' && e?.test === name) {
      return { skip: true, reason: e.reason }
    }
    if (kind === 'entityOp') {
      const key = (e?.entity ?? '') + '.' + (e?.op ?? '')
      if (key === name) return { skip: true, reason: e.reason }
    }
  }
  return { skip: false }
}


// Skips the current test if sdk-test-control.json lists it. Returns true
// when skipped (caller should `return` immediately).
function maybeSkipControl(
  t: any,
  kind: 'direct' | 'entityOp',
  name: string,
  live: boolean
): boolean {
  const decision = isControlSkipped(kind, name, live ? 'live' : 'unit')
  if (decision.skip) {
    t.skip(decision.reason || 'skipped via sdk-test-control.json')
    return true
  }
  return false
}


// Skips the current live test when required idmap keys aren't supplied.
// Generated tests call this when they would otherwise pass `undefined`
// values into a path/query param and 4xx the request.
function skipIfMissingIds(t: any, setup: any, requiredKeys: string[]): boolean {
  if (!setup.live) return false
  const missing = requiredKeys.filter(k => null == setup.idmap?.[k])
  if (missing.length > 0) {
    t.skip(`live test needs ${missing.join(', ')} via *_ENTID env var (synthetic IDs only)`)
    return true
  }
  return false
}


// Extra SDK options every LIVE client is constructed with, from
// sdk-test-control.json `test.client.options`.
//
// The generated live client knows two things: the base URL (from the spec)
// and the credential (from the environment). Everything else about how a
// particular API wants to be talked to — which features to switch on, and
// with what settings — is a property of THAT API, known to the project and
// to nothing in the toolchain.
//
// The concrete case: an API that issues short-lived access tokens needs the
// `secrets` feature's exchange turned on and pointed at its token endpoint,
// or the live suite gets a handful of calls in and then fails 401 with
// nothing explaining why. There was no seam for that, so the suite could
// not be run at all.
//
// A committed FILE rather than an environment variable, because it is
// configuration, not a secret: it belongs in the repo next to the API it
// describes, where it can be read and reviewed. Secrets still come from the
// environment (the providers this block names read them).
//
// Merged UNDER the generated fields, so the suite's own base/apikey/server
// values win — this adds to the live client, it does not redirect it.
//
// That contract is enforced HERE rather than left to each merge site: the
// generated object only names a field when the model calls for one, so a
// `base` in this block would face no competing value and would silently
// redirect the whole suite — credential included — to another host. The
// reserved fields are stripped once, where the block is read, so every
// caller gets the same guarantee whether or not it happens to emit them.
const LIVE_RESERVED = ['base', 'prefix', 'suffix', 'server', 'apikey', 'secret']

function liveClientOptions(): Record<string, any> {
  const opts = loadTestControl()?.test?.client?.options

  if (null == opts || 'object' !== typeof opts) {
    return {}
  }

  const out: Record<string, any> = {}
  for (const key of Object.keys(opts)) {
    if (!LIVE_RESERVED.includes(key)) {
      out[key] = (opts as any)[key]
    }
  }

  return out
}


// Per-test live pacing delay (ms). Read from sdk-test-control.json
// `test.live.delayMs`; defaults to 500ms if absent or invalid.
function liveDelayMs(): number {
  const ctrl = loadTestControl()
  const v = ctrl?.test?.live?.delayMs
  return ('number' === typeof v && v >= 0) ? v : 500
}


// afterEach hook helper for live pacing. Generated tests register this
// via `afterEach(liveDelay(<envVar>))`; it sleeps `liveDelayMs()` only
// when the SDK's *_TEST_LIVE env var is set.
function liveDelay(liveEnvVar: string): () => Promise<void> {
  return async () => {
    if ('TRUE' === process.env[liveEnvVar]) {
      await new Promise(r => setTimeout(r, liveDelayMs()))
    }
  }
}


// Load a .env.local file into process.env, replacing the `dotenv`
// devDependency — the SDK's last non-tooling package.
//
// Same semantics dotenv gave these tests: a missing file is fine, and a key
// already present in the environment is never overridden, so an explicit
// export still beats the file.
//
// WHY NOT sekreto's parsedotenv, which does the same job and is already
// vendored: sekreto lives INSIDE the secrets feature container, so `target
// add` removes it whenever a project does not select that feature — while
// these entity tests need the loader either way. Importing it here would
// couple every generated test suite to an optional feature. The parser is
// small enough that a second, independent copy is cheaper than that
// coupling; it deliberately handles only what a .env.local holds.
function loadEnvLocal(file: string): void {
  let text: string
  try {
    text = Fs.readFileSync(file, 'utf8')
  }
  catch (err: any) {
    if ('ENOENT' === err.code) {
      return
    }
    throw err
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()

    // Blank and comment lines. A '#' INSIDE a value is not a comment.
    if ('' === line || line.startsWith('#')) {
      continue
    }

    const eq = line.indexOf('=')
    if (0 >= eq) {
      continue
    }

    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    let val = line.slice(eq + 1).trim()

    const quote = ("'" === val[0] || '"' === val[0]) ? val[0] : ''

    if ('' !== quote) {
      // Quoted: the value runs to the CLOSING quote, and a '#' inside it is
      // part of the value. Anything after the closing quote is a comment.
      const close = val.indexOf(quote, 1)
      val = 0 < close ? val.slice(1, close) : val.slice(1)
    }
    else {
      // Unquoted: the first '#' starts an inline comment, with or without
      // preceding whitespace — `A=a#b` is `a` to dotenv, not `a#b`.
      // Dropping this made `KEY=secret # note` resolve to the whole string
      // including the note, and a generated live test would then send that
      // as the credential. Verified against dotenv's own parse().
      const hash = val.indexOf('#')
      if (0 <= hash) {
        val = val.slice(0, hash)
      }
      val = val.trim()
    }

    if (undefined === process.env[key]) {
      process.env[key] = val
    }
  }
}


export {
  makeStepData,
  makeMatch,
  makeReqdata,
  makeValid,
  makeCtrl,
  envOverride,
  loadTestControl,
  isControlSkipped,
  maybeSkipControl,
  skipIfMissingIds,
  liveClientOptions,
  liveDelayMs,
  liveDelay,
  loadEnvLocal,
}

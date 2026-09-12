// VENDORED: @voxgig/omni 0.1.4 (typescript/src/Runner.ts)
// Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// Omni: the shared multi-language test runner.
//
// A test spec is plain JSON. The same spec file drives the same tests in
// every language that ships an omni port, so behaviour is defined once and
// verified everywhere.
//
// This file is CANONICAL. Every other port is a translation of it.

import { readFileSync } from 'node:fs'

import {
  EXISTSMARK,
  Json,
  NULLMARK,
  UNDEFMARK,
  clone,
  deepequal,
  getpath,
  islist,
  ismap,
  isnode,
  pathify,
  stringify,
  walk,
} from './Util'

// A test subject: the function under test.
export type Subject = (...args: Json[]) => any

// Run-time options for a set of test entries.
export type Flags = {
  // Convert JSON nulls to the NULLMARK sentinel (default: true).
  null?: boolean
  // Label used in failure messages (default: the runner name).
  name?: string
  [flag: string]: any
}

// The host of the system under test. Every hook is optional: a spec that
// resolves its subjects explicitly needs no provider at all.
export type Provider = {
  // Resolve a test subject by name.
  subject?: (name: string) => Subject | undefined | null
  // Build a sub-provider from a spec DEF.client entry's options.
  client?: (options: Json) => Provider | Promise<Provider>
  // Wrap a map argument as a call context before it is passed in.
  contextify?: (val: Json) => Json
  // Resolve references in client options against the runner store.
  inject?: (options: Json, store: Json) => Json
  // Build the `match.err` base from the raised error. See `errify`.
  errify?: (err: any) => Json
}

export type RunSet = (testspec: Json, testsubject?: Subject) => Promise<void>

export type RunSetFlags = (
  testspec: Json,
  flags: Flags,
  testsubject?: Subject,
) => Promise<void>

export type RunPack = {
  // The resolved spec (the named section, or the whole file).
  spec: Json
  // Run one set of test entries.
  runset: RunSet
  // Run one set of test entries with flags.
  runsetflags: RunSetFlags
  // The default subject, if the provider could resolve one.
  subject?: Subject
  // The root provider.
  client?: Provider
}

export type Runner = (name?: string, store?: Json) => Promise<RunPack>

// The newest spec format version this runner understands. A spec with no
// OMNI block is version 0: the original, lenient format, frozen forever.
// Version 1 turns on strict entry validation (see checkentry).
export const SPECVERSION = 1

// Capability strings this runner supports beyond the version baseline. A
// spec's OMNI.requires list is checked against this: an unknown capability
// refuses the spec loudly at load time, instead of a lagging port silently
// mis-running it. (Empty today; future format features mint a string here.)
export const CAPABILITIES: string[] = []

// The complete set of fields an entry may carry. Under version 1 anything
// else is an error: an unrecognised key is almost always a typo'd
// assertion, and a typo'd assertion is a test that silently stopped
// testing.
const ENTRYFIELDS = ['in', 'args', 'ctx', 'out', 'err', 'match', 'client', 'id', 'doc']

// A test failure (or a malformed spec). Distinct from errors thrown by the
// subject under test, which are candidates for an `err` expectation.
export class OmniError extends Error {
  entry?: Json
  constructor(message: string, entry?: Json) {
    super(message)
    this.name = 'OmniError'
    this.entry = entry
  }
}

// Load a spec: either a path to a JSON file, or an already-parsed object.
function loadspec(specref: string | Json): Json {
  if ('string' === typeof specref) {
    return JSON.parse(readFileSync(specref, 'utf8'))
  }
  return specref
}

// Read the spec's format version from its optional top-level OMNI block,
// and refuse a spec this runner cannot faithfully run: a version newer
// than SPECVERSION, or a required capability not in CAPABILITIES.
function resolveversion(alltests: Json): number {
  const meta = ismap(alltests) ? alltests.OMNI : undefined

  if (undefined === meta) {
    return 0
  }

  if (!ismap(meta) || 'number' !== typeof meta.version || 0 !== meta.version % 1) {
    throw new OmniError('omni: malformed OMNI version block')
  }

  if (meta.version < 0 || SPECVERSION < meta.version) {
    throw new OmniError('omni: unsupported spec version: ' + meta.version)
  }

  const requires = meta.requires
  if (undefined !== requires) {
    if (!islist(requires)) {
      throw new OmniError('omni: malformed OMNI requires list')
    }
    for (const cap of requires) {
      if ('string' !== typeof cap || !CAPABILITIES.includes(cap)) {
        throw new OmniError('omni: spec requires unsupported capability: ' + stringify(cap))
      }
    }
  }

  return meta.version
}

// Strict entry validation, applied when the spec declares version 1 or
// later. The lenient format converts each of these mistakes into a silent
// pass or a dead field; here they fail with the entry named.
function checkentry(flags: Flags, index: number, entry: Json): void {
  if (!ismap(entry)) {
    throw fail(flags, index, entry, 'entry is not a map')
  }

  for (const key of Object.keys(entry)) {
    if (!ENTRYFIELDS.includes(key)) {
      throw fail(flags, index, entry, 'unknown entry field: ' + key)
    }
  }

  let argsources = 0
  for (const key of ['in', 'args', 'ctx']) {
    if (undefined !== entry[key]) {
      argsources++
    }
  }
  if (1 < argsources) {
    throw fail(flags, index, entry, 'entry has more than one of in, args, ctx')
  }

  if (null != entry.err && undefined !== entry.out) {
    throw fail(flags, index, entry, 'entry has both err and out')
  }

  if (undefined !== entry.id && 'string' !== typeof entry.id) {
    throw fail(flags, index, entry, 'entry id is not a string')
  }
}

// Validate a version-1 group up front, against the AUTHORED entries -
// null-normalisation would otherwise rewrite an authored null (e.g.
// id: null) into a sentinel string and hide it from validation. A
// malformed spec is a spec error, not a test result, so it fails before
// any subject runs.
function checkset(flags: Flags, testspec: Json, normalset: Json[]): void {
  const origset =
    ismap(testspec) && islist(testspec.set) ? testspec.set : normalset

  if (0 === origset.length && true !== (ismap(testspec) ? testspec.empty : undefined)) {
    throw new OmniError('omni: empty test set: ' + flags.name)
  }

  for (let index = 0; index < origset.length; index++) {
    checkentry(flags, index, origset[index])
  }
}

// Find the named section of a spec: `primary.<name>`, then `<name>`, then
// the whole spec.
function resolvespec(name: string | undefined, alltests: Json): Json {
  if (null == name) {
    return alltests
  }

  const primary = alltests.primary
  if (ismap(primary) && null != primary[name]) {
    return primary[name]
  }

  if (ismap(alltests) && null != alltests[name]) {
    return alltests[name]
  }

  return alltests
}

// Build the named clients declared by the spec's DEF.client block.
async function resolveclients(
  provider: Provider,
  spec: Json,
  store: Json,
): Promise<Record<string, Provider>> {
  const clients: Record<string, Provider> = {}

  const defclient = ismap(spec) && ismap(spec.DEF) ? spec.DEF.client : undefined
  if (!ismap(defclient)) {
    return clients
  }

  // A spec may define clients that a given test run never references.
  if (null == provider.client) {
    return clients
  }

  for (const clientname of Object.keys(defclient)) {
    const cdef = defclient[clientname]
    const copts = clone((ismap(cdef) && ismap(cdef.test) ? cdef.test.options : undefined) || {})

    if (ismap(store) && null != provider.inject) {
      provider.inject(copts, store)
    }

    clients[clientname] = await provider.client(copts)
  }

  return clients
}

function resolvesubject(name: string | undefined, provider: Provider): Subject | undefined {
  if (null == name || null == provider.subject) {
    return undefined
  }
  return provider.subject(name) || undefined
}

function resolveflags(flags?: Flags): Flags {
  const out: Flags = null == flags ? {} : { ...flags }
  out.null = null == out.null ? true : !!out.null
  return out
}

// An entry with no `out` expects a null (or absent) result.
function resolveentry(entry: Json, flags: Flags): Json {
  if (null == entry.out && flags.null) {
    entry.out = NULLMARK
  }
  return entry
}

function resolvetestpack(
  name: string | undefined,
  entry: Json,
  subject: Subject,
  provider: Provider,
  clients: Record<string, Provider>,
) {
  const testpack = { client: provider, subject }

  if (null != entry.client) {
    const client = clients[entry.client]
    if (null == client) {
      throw new OmniError('omni: unknown client: ' + entry.client, entry)
    }
    testpack.client = client
    testpack.subject = resolvesubject(name, client) || subject
  }

  return testpack
}

// Build the argument list for one entry: `ctx` (single context argument),
// `args` (explicit list), or `in` (single value).
function resolveargs(entry: Json, testpack: { client: Provider }, provider: Provider): Json[] {
  let args: Json[]

  if (undefined !== entry.ctx) {
    args = [entry.ctx]
  } else if (undefined !== entry.args) {
    args = entry.args
  } else {
    args = [clone(entry.in)]
  }

  if (undefined !== entry.ctx || undefined !== entry.args) {
    let first = args[0]
    if (ismap(first)) {
      first = clone(first)
      if (null != provider.contextify) {
        first = provider.contextify(first)
      }
      args[0] = first
      entry.ctx = first
      if (ismap(first)) {
        first.client = testpack.client
      }
    }
  }

  return args
}

// Normalise a value for comparison: JSON nulls (and absent values) become
// the NULLMARK sentinel, errors become {name,message} maps. Always returns
// a fresh copy, so a spec can be run repeatedly.
function fixjson(val: Json, flags?: Flags): Json {
  const donull = null == flags || null == flags.null ? true : !!flags.null
  return fixjsonval(val, donull)
}

function fixjsonval(val: Json, donull: boolean): Json {
  if (null == val) {
    return donull ? NULLMARK : val
  }

  if (val instanceof Error) {
    return errify(val)
  }

  if (islist(val)) {
    return val.map((entry: Json) => fixjsonval(entry, donull))
  }

  if (ismap(val)) {
    const out: Record<string, Json> = {}
    for (const key of Object.keys(val)) {
      out[key] = fixjsonval(val[key], donull)
    }
    return out
  }

  return val
}

// The JSON form of an error: always at least {name,message}.
//
// A thrown value need not be an Error. Ports commonly rethrow an
// error-SHAPED map ({name, message, ...}) - voxgig/sdkgen's generated
// makeError rethrows the fixture's own error object verbatim - and
// collapsing that to String(err) yields '[object Object]', which fails both
// the `err` check and every `match.err.*` leaf. The struct repository's
// original runner read `.message` regardless of the thrown value's class.
// THE SPREAD IS THE CONTRACT, not an accident of JavaScript. An error's
// OWN enumerable properties survive into the base, so a library whose
// errors carry a `code` (or a `status`, or a `path`) can assert on it
// with `match: {err: {code: 'x'}}` rather than pattern-matching prose.
//
// Only JavaScript gets that for free. A port whose subject reports
// failure as a message string - rust, cpp, zig, ocaml, haskell - has
// nothing to spread, and a port that builds `{name, message}` by hand
// drops the fields even when it has them. `Provider.errify` is how those
// ports reach the same place: it overrides this function entirely, so a
// library supplies its own structured base and omni needs to know
// nothing about the shape of it.
function errify(err: any): Json {
  if (err instanceof Error) {
    return { ...err, name: err.name, message: err.message }
  }

  if (null != err && 'object' === typeof err) {
    return { name: 'Error', ...err }
  }

  return { name: 'Error', message: String(err) }
}

// The error base a `match.err` sees: the provider's own, when it has one.
function errbase(err: any, provider?: Provider): Json {
  return null != provider && null != provider.errify
    ? provider.errify(err)
    : errify(err)
}

function errmessage(err: any): string {
  return err instanceof Error ? err.message
    : null != err && 'string' === typeof err.message ? err.message
      : String(err)
}

// The label of one entry, for failure messages.
function entryref(flags: Flags, index: number, entry: Json): string {
  const label = flags.name || 'set'
  const id = null != entry && null != entry.id ? ' (' + entry.id + ')' : ''
  return label + '[' + index + ']' + id
}

function fail(
  flags: Flags,
  index: number,
  entry: Json,
  reason: string,
  expected?: string,
  actual?: string,
): OmniError {
  let msg = 'omni: ' + entryref(flags, index, entry) + ': ' + reason
  if (undefined !== expected) {
    msg += '\n  expected: ' + expected
  }
  if (undefined !== actual) {
    msg += '\n  actual:   ' + actual
  }
  msg += '\n  entry:    ' + stringify(entrysummary(entry))
  return new OmniError(msg, entry)
}

// The spec-defined part of an entry (drop runner bookkeeping).
function entrysummary(entry: Json): Json {
  if (!ismap(entry)) {
    return entry
  }
  const out: Record<string, Json> = {}
  for (const key of Object.keys(entry)) {
    if ('res' !== key && 'thrown' !== key && 'ctx' !== key) {
      out[key] = entry[key]
    }
  }
  return out
}

function checkresult(flags: Flags, index: number, entry: Json, args: Json[], res: Json) {
  let matched = false

  if (null != entry.err) {
    throw fail(
      flags,
      index,
      entry,
      'expected error did not occur',
      stringify(entry.err),
      stringify(res),
    )
  }

  if (null != entry.match) {
    match(flags, index, entry, entry.match, {
      in: entry.in,
      args,
      out: entry.res,
      ctx: entry.ctx,
    })
    matched = true
  }

  const out = entry.out

  if (out === res) {
    return
  }

  // NOTE: a match with no explicit out is a complete check on its own.
  if (matched && (NULLMARK === out || null == out)) {
    return
  }

  if (!deepequal(res, out)) {
    throw fail(flags, index, entry, 'result mismatch', stringify(out), stringify(res))
  }
}

function handleerror(
  flags: Flags,
  index: number,
  entry: Json,
  err: any,
  provider?: Provider,
) {
  entry.thrown = err

  const entryerr = entry.err

  if (null != entryerr) {
    if (true === entryerr || matchval(entryerr, errmessage(err))) {
      if (null != entry.match) {
        match(flags, index, entry, entry.match, {
          in: entry.in,
          out: entry.res,
          ctx: entry.ctx,
          err: errbase(err, provider),
        })
      }
      return
    }

    throw fail(flags, index, entry, 'error mismatch', stringify(entryerr), errmessage(err))
  }

  throw fail(flags, index, entry, 'unexpected error', undefined, errmessage(err))
}

// Check that every leaf of `check` is present, and matches, in `base`.
function match(flags: Flags, index: number, entry: Json, check: Json, base: Json) {
  // Read the base DIRECTLY. The clone bought nothing - the walk below only
  // reads, via getpath - and it blows the stack on a cyclic base. A port
  // that drives entries with live objects rather than pure JSON produces
  // those routinely: voxgig/sdkgen's corpus matches against a live client
  // context whose root context reaches the client again.
  const cbase = base

  const at = (path: Json[]) => (0 === path.length ? '<root>' : pathify(path))

  walk(clone(check), (_key, val, _parent, path) => {
    // An empty container in the check is a structural placeholder: it has
    // no leaves to check, so it matches whatever is at that path. This is
    // deliberate - voxgig/struct's corpus relies on it (struct-compat), and
    // an empty sub-pattern matching anything is the usual partial-match
    // convention. The leaf checks below are where the strictness lives.
    if (!isnode(val)) {
      const baseval = getpath(cbase, path)

      // The sentinels are tested BEFORE the identity check below. Otherwise
      // a subject returning the literal string "__UNDEF__" satisfies an
      // assertion that the key is absent - two mutually exclusive states
      // passing one check. A sentinel that accepts its own literal is not a
      // sentinel. (NULLMARK still accepts NULLMARK: under the default null
      // flag a real null has already been normalised to it, so the two are
      // genuinely indistinguishable here - that one needs a raw-value
      // escape, not an ordering change.)

      // Explicitly absent: satisfied only by a genuinely missing key, never
      // by a present null (the distinction the sentinels exist to keep).
      if (UNDEFMARK === val) {
        if (undefined === baseval) {
          return val
        }
        throw fail(flags, index, entry, 'expected absent at ' + at(path), 'absent', stringify(baseval))
      }

      // Explicitly null: satisfied only by a present null.
      if (NULLMARK === val) {
        if (null === baseval || NULLMARK === baseval) {
          return val
        }
        throw fail(flags, index, entry, 'expected null at ' + at(path), 'null', stringify(baseval))
      }

      // Explicitly present: any present value, including null.
      if (EXISTSMARK === val) {
        if (undefined !== baseval) {
          return val
        }
        throw fail(flags, index, entry, 'expected present at ' + at(path), 'present', 'absent')
      }

      // Identical values match. This sits below the sentinel branches on
      // purpose - see the note above.
      if (baseval === val) {
        return val
      }

      // A concrete expectation never matches a missing key - a match leaf
      // against an absent value must fail, not substring-match "undefined".
      if (undefined === baseval) {
        throw fail(flags, index, entry, 'match failed at ' + at(path), stringify(val), 'absent')
      }

      if (!matchval(val, baseval)) {
        throw fail(flags, index, entry, 'match failed at ' + at(path), stringify(val), stringify(baseval))
      }
    }

    return val
  })
}


// Match one leaf. Strings are matched as /regex/ or as a case-insensitive
// substring, which is what makes error-message expectations portable.
function matchval(check: Json, base: Json): boolean {
  if (check === base) {
    return true
  }

  let want = check
  if (UNDEFMARK === want || NULLMARK === want) {
    want = null
  }

  if (null == want) {
    return null == base || NULLMARK === base
  }

  if ('string' === typeof want) {
    // An empty want is not a wildcard: the empty string is a substring of
    // everything, so `match:{out:""}` (or `err:""`) would accept any value.
    if ('' === want) {
      return '' === base
    }

    const basestr = stringify(base)

    const rem = want.match(/^\/(.+)\/$/)
    if (rem) {
      return new RegExp(rem[1]).test(basestr)
    }

    return basestr.toLowerCase().includes(want.toLowerCase())
  }

  if ('function' === typeof want) {
    return true
  }

  return deepequal(want, base)
}

// Convert NULLMARK sentinels back into real nulls. Use as a walk callback
// when a spec value must reach the subject as an actual null.
function nullmodifier(val: Json, key: any, parent: Json) {
  if (NULLMARK === val) {
    parent[key] = null
  } else if ('string' === typeof val) {
    parent[key] = val.split(NULLMARK).join('null')
  }
}

// Make a runner for a spec file (or spec object) and a provider.
async function makeRunner(specref: string | Json, provider?: Provider): Promise<Runner> {
  const alltests = loadspec(specref)
  const specversion = resolveversion(alltests)
  const useprovider: Provider = provider || {}

  return async function runner(name?: string, store?: Json): Promise<RunPack> {
    const spec = resolvespec(name, alltests)
    const clients = await resolveclients(useprovider, spec, store || {})
    const defsubject = resolvesubject(name, useprovider)

    const runsetflags: RunSetFlags = async (
      testspec: Json,
      flags: Flags,
      testsubject?: Subject,
    ) => {
      const useflags = resolveflags(flags)
      useflags.name = useflags.name || name || 'set'

      const subject = testsubject || defsubject
      if (null == subject) {
        throw new OmniError('omni: no test subject for: ' + useflags.name)
      }

      const testspecmap = fixjson(testspec, useflags)

      if (!ismap(testspecmap) || !islist(testspecmap.set)) {
        throw new OmniError('omni: test spec has no set: ' + useflags.name)
      }

      const testset: Json[] = testspecmap.set

      if (1 <= specversion) {
        checkset(useflags, testspec, testset)
      }

      for (let index = 0; index < testset.length; index++) {
        let entry = testset[index]

        try {
          entry = resolveentry(entry, useflags)

          const testpack = resolvetestpack(name, entry, subject, useprovider, clients)
          const args = resolveargs(entry, testpack, useprovider)

          let res = await testpack.subject(...args)
          res = fixjson(res, useflags)
          entry.res = res

          checkresult(useflags, index, entry, args, res)
        } catch (err: any) {
          if (err instanceof OmniError) {
            throw err
          }
          handleerror(useflags, index, entry, err, useprovider)
        }
      }
    }

    const runset: RunSet = async (testspec: Json, testsubject?: Subject) =>
      runsetflags(testspec, {}, testsubject)

    return {
      spec,
      runset,
      runsetflags,
      subject: defsubject,
      client: useprovider,
    }
  }
}

export {
  EXISTSMARK,
  NULLMARK,
  UNDEFMARK,
  errify,
  fixjson,
  loadspec,
  makeRunner,
  match,
  matchval,
  nullmodifier,
  resolvespec,
}

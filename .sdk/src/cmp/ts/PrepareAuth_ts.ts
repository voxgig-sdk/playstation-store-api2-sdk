
import {
  Content,
  File,
  Folder,
  cmp,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated.
//
// This was a static file in `tm/ts/src/utility/` that hardcoded
// `Authorization` and a header. apidef has always resolved the scheme's
// `in` and `name` into `main.kit.info.security` — joplin's says
// `in: "query", name: "token"` — and generation dropped both. The result
// was an SDK that sent a header the API does not read and never sent the
// query parameter it does, so it could not authenticate at all. Four
// repos in the cedar fleet shipped that way: joplin (`token`), pipedrive
// (`api_token`), trello (`key`), lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in
// a bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // The ONE signal that can honestly be honoured before runtime: the
  // project saying "this SDK sends no credential, ever". Not
  // `isAuthActive`, which is also false when the SPEC merely declares no
  // scheme — those SDKs have always sent options.apikey.
  const suppressed = isAuthSuppressed(model)
  const where = resolveAuthIn(model)
  // LOWERCASED FOR A HEADER, VERBATIM OTHERWISE. HTTP header names are
  // case-insensitive on the wire, but the SDK's header map is a plain
  // object keyed in lower case: the old template hardcoded
  // `'authorization'`, the shared corpus asserts
  // `ctx:spec:headers:authorization`, and every generatedcompile probe
  // reads the lower-case key. apidef writes `name: "Authorization"`, so
  // emitting it verbatim puts the credential under a key nothing reads.
  // A query parameter and a cookie ARE case-sensitive, so they keep the
  // spec's spelling exactly.
  const resolvedName = resolveAuthName(model)
  const name = 'header' === where ? resolvedName.toLowerCase() : resolvedName
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  // No `src` folder here: Main already opened it, and Config and SdkError
  // write straight into it. Opening a second one puts the file at
  // src/src/utility/ — where nothing imports it, and the stale copy at
  // src/utility/ keeps being used.
  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuthUtility.' + target.ext }, () => {
      Content(render({ suppressed, where, name, prefix, basic }))
    })
  })
})


function render(spec: {
  suppressed: boolean, where: string, name: string, prefix: string, basic: boolean
}): string {
  const head = `
import { Context, Spec } from '../types'

`

  // NO GENERATION-TIME GATE ON WHETHER TO PLACE A CREDENTIAL AT ALL.
  //
  // The obvious move is to emit a no-op when `isAuthActive(model)` is
  // false, and it is wrong. That is false whenever `main.kit.info.auth`
  // is false — i.e. the SPEC declares no security scheme — but the SDK
  // still carries a credential: `optspec` always declares `apikey`, and
  // makeOptions fills `options.auth` from the optspec defaults, so the
  // template's `null == options.auth` guard never actually fired and
  // every such SDK has always sent `options.apikey`. Suppressing that at
  // generation time silently breaks a working credential, which
  // `auth null suppresses the credential` in generatedcompile catches,
  // and takes the secrets feature down with it — the feature resolves a
  // secret into options.apikey and prepareAuth then places nothing.
  //
  // `auth: null` is the DOCUMENTED suppression, it is a runtime value,
  // and the runtime guard below is the one that honours it.

  // Auth switched off outright by the project. The credential-placing
  // body would be dead code, so it is not emitted — but the function
  // stays, because makeSpec calls it unconditionally.
  if (spec.suppressed) {
    return head + `
function prepareAuth(ctx: Context): Spec | Error {
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }

  return spec
}


export {
  prepareAuth
}
`
  }

  const preamble = `
const CRED_name = '${jsstr(spec.name)}'

const OPTION_apikey = 'apikey'
const OPTION_secret = 'secret'

const NOTFOUND = '__NOTFOUND__'


function prepareAuth(ctx: Context): Spec | Error {
  const utility = ctx.utility

  const struct = utility.struct
  const getprop = struct.getprop
  const setprop = struct.setprop
  const delprop = struct.delprop

  const client = ctx.client
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }

  const ${target(spec.where)} = spec.${target(spec.where)}

  const options = client.options()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (null == options.auth) {
    ${clear(spec.where)}
    return spec
  }

  const prefix = options.auth.prefix

  const apikey = getprop(options, OPTION_apikey, NOTFOUND)
`

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it
  // can mean something.
  const basicBlock = (spec.basic && 'header' === spec.where) ? `
  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  if (true === options.auth.basic) {
    const secret = getprop(options, OPTION_secret, NOTFOUND)
    const noApikey = NOTFOUND === apikey || null == apikey || '' === apikey
    const noSecret = NOTFOUND === secret || null == secret || '' === secret

    if (noApikey || noSecret) {
      delprop(headers, CRED_name)
    }
    else {
      const b64 = Buffer.from(apikey + ':' + secret).toString('base64')
      setprop(headers, CRED_name, prefix ? prefix + ' ' + b64 : b64)
    }

    return spec
  }
` : ''

  return head + preamble + basicBlock + `
  if (NOTFOUND === apikey || null == apikey || '' === apikey) {
    ${clear(spec.where)}
  }
  else {
${place(spec.where)}
  }

  return spec
}


export {
  prepareAuth
}
`
}


// The bag the credential lands in, per placement. Cookies ride the header
// bag because a cookie IS a header.
function target(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


function clear(where: string): string {
  return 'query' === where ? 'delprop(query, CRED_name)' : 'delprop(headers, CRED_name)'
}


function place(where: string): string {
  if ('query' === where) {
    // NO PREFIX IN A QUERY STRING. `?token=Bearer%20abc` is not a thing any
    // API reads; the prefix is a header convention and is dropped here
    // deliberately rather than silently concatenated.
    return `    setprop(query, CRED_name, apikey)`
  }

  if ('cookie' === where) {
    return `    const existing = getprop(headers, 'cookie', '')
    const pair = CRED_name + '=' + apikey
    setprop(headers, 'cookie', existing ? existing + '; ' + pair : pair)`
  }

  return `    // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
    // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
    setprop(headers, CRED_name, prefix ? prefix + ' ' + apikey : apikey)`
}


function jsstr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}


export {
  PrepareAuth
}

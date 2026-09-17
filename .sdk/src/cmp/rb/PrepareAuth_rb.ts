
import {
  Content,
  File,
  Folder,
  cmp,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated.
//
// This was a static file at `tm/rb/utility/prepare_auth.rb` that hardcoded
// `HEADER_AUTH = "authorization"`. apidef has always resolved the scheme's
// `in` and `name` into `main.kit.info.security` — joplin's says
// `in: "query", name: "token"` — and generation dropped both. The result
// was an SDK that sent a header the API does not read and never sent the
// query parameter it does, so it could not authenticate at all. Four repos
// in the cedar fleet shipped that way: joplin (`token`), pipedrive
// (`api_token`), trello (`key`), lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
//
// The ts port is the reference (cmp/ts/PrepareAuth_ts.ts). Two things are
// deliberately NOT the same here, both recorded at their site below: the
// header name is lower-cased, and the cookie clear removes our own pair
// instead of a header that was never set.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const active = authSwitchedOn(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const basic = isHttpBasicAuth(model)

  // RB'S LAYOUT IS FLAT, WHICH IS WHY THIS FOLDER IS OPENED HERE AND THE TS
  // PORT OPENS NONE. In ts, Main wraps its whole body in
  // `Folder({name:'src'})` and the utilities live at `src/utility/`, so a
  // second `src` there would write `src/src/utility/`. Main_rb opens no such
  // folder: `Package`, `Gitignore`, the SDK file and `Copy({from:'tm/rb'})`
  // all land at the target root, and `Config` sits inside a `Folder({name:
  // '.'})` that is the root too. The template this replaces was
  // `tm/rb/utility/prepare_auth.rb`, and that Copy's root IS the target root,
  // so the file it produced was `<root>/utility/prepare_auth.rb`. One folder,
  // `utility`, reproduces exactly that path — and register.rb's
  // `require_relative 'prepare_auth'` (from `utility/`) only resolves there.
  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({ Name: model.const.Name, active, where, name, basic }))
    })
  })
})


function render(spec: {
  Name: string, active: boolean, where: string, name: string, basic: boolean
}): string {
  const head = `# ${spec.Name} SDK utility: prepare_auth
require_relative 'struct/voxgig_struct'
module ${spec.Name}Utilities
`

  const guard = `  PrepareAuth = ->(ctx) {
    spec = ctx.spec
    return nil, ctx.make_error("auth_no_spec", "Expected context spec property to be defined.") unless spec
`

  // NO AUTH AT ALL. A public API's SDK gets a prepare_auth that is honest
  // about it rather than one that deletes a header nobody set.
  if (!spec.active) {
    return head + `  # This API declares no authentication, so there is no credential to
  # place. The utility stays in the pipeline because make_spec calls it
  # unconditionally, and register.rb binds it unconditionally.
${guard}
    return spec, nil
  }
end
`
  }

  const cookie = 'cookie' === spec.where
  const query = 'query' === spec.where

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it can
  // mean something.
  const basicHere = spec.basic && 'header' === spec.where

  // The constant keeps the template's name per placement, so a
  // header-based SDK regenerates the file it already had.
  const CRED = query ? 'QUERY_AUTH' : cookie ? 'COOKIE_AUTH' : 'HEADER_AUTH'

  // HEADER NAMES ARE LOWER-CASED; QUERY AND COOKIE NAMES ARE NOT.
  //
  // `resolveAuthName` answers 'Authorization' by default, but the whole rb
  // runtime spells header names in lower case — the template's
  // `HEADER_AUTH = "authorization"`, secrets_feature.rb's
  // `headers["authorization"]`, debug_feature.rb's mask list. A Ruby Hash key
  // is case-sensitive, so emitting "Authorization" here would leave the
  // secrets feature writing a SECOND, separate header and the copied
  // pipeline_test.rb assertions on `headers["authorization"]` failing. HTTP
  // header names are case-insensitive on the wire, so lower-casing costs
  // nothing. Query parameter and cookie names ARE case-sensitive (`?Token=`
  // is not `?token=`), so those go in verbatim.
  const credName = query || cookie ? spec.name : spec.name.toLowerCase()

  const consts =
    `  ${CRED} = ${rbstr(credName)}
` +
    (cookie ? `  HEADER_COOKIE = "cookie"
` : '') +
    `  OPTION_APIKEY = "apikey"
` +
    (basicHere ? `  OPTION_SECRET = "secret"
` : '') +
    `  NOT_FOUND = "__NOTFOUND__"

`

  // The bag the credential lands in. A cookie rides the header bag, because
  // a cookie IS a header.
  const bag = query
    ? `    query = spec.query
`
    : `    headers = spec.headers
`

  // Removing OUR pair, not the whole cookie header. The ts port deletes
  // `headers[CRED_name]` for the cookie case, which is a header nothing ever
  // set — so a stale cookie survives a withdrawn credential there. This
  // splits the header, drops the one pair we own, and puts the rest back.
  const dropCookie = !cookie ? '' : `
    # Our own pair, and only ours: another cookie the caller set survives.
    drop_cookie = ->(hs) {
      cookie = hs[HEADER_COOKIE]
      return unless cookie.is_a?(String)
      rest = cookie.split("; ").reject { |pair| pair.start_with?("#{COOKIE_AUTH}=") }
      if rest.empty?
        hs.delete(HEADER_COOKIE)
      else
        hs[HEADER_COOKIE] = rest.join("; ")
      end
    }
`

  const clear = cookie ? 'drop_cookie.call(headers)'
    : query ? `query.delete(${CRED})`
      : `headers.delete(${CRED})`

  const preamble = guard + `
` + bag + `    options = ctx.client.options_map
` + dropCookie + `
    # Public APIs that need no auth omit the options.auth block entirely.
    if options["auth"].nil?
      ${clear}
      return spec, nil
    end

    apikey = VoxgigStruct.getprop(options, OPTION_APIKEY, NOT_FOUND)
`

  const basicBlock = !basicHere ? '' : `
    # True HTTP Basic Auth needs TWO credentials, base64-joined - a single
    # token in the header (the branch below) can never authenticate against
    # an API that actually checks \`Authorization: Basic base64(user:pass)\`.
    if VoxgigStruct.getpath(options, "auth.basic") == true
      secret = VoxgigStruct.getprop(options, OPTION_SECRET, NOT_FOUND)
      no_apikey = apikey.nil? || !apikey.is_a?(String) || apikey == NOT_FOUND || apikey == ""
      no_secret = secret.nil? || !secret.is_a?(String) || secret == NOT_FOUND || secret == ""

      if no_apikey || no_secret
        headers.delete(HEADER_AUTH)
      else
        auth_prefix = VoxgigStruct.getpath(options, "auth.prefix") || ""
        # \`pack("m0")\` rather than \`Base64.strict_encode64\`: base64 left
        # Ruby's default gems in 3.4, and pack is core.
        b64 = ["#{apikey}:#{secret}"].pack("m0")
        headers[HEADER_AUTH] =
          auth_prefix.empty? ? b64 : "#{auth_prefix} #{b64}"
      end

      return spec, nil
    end
`

  return head + consts + preamble + basicBlock + place(spec.where, clear) + `
    return spec, nil
  }
end
`
}


// The one thing that actually differs between placements: where the
// credential is written, and whether the prefix travels with it.
function place(where: string, clear: string): string {
  // NO PREFIX IN A QUERY STRING. `?token=Bearer%20abc` is not a thing any
  // API reads; the prefix is a header convention and is dropped here
  // deliberately rather than silently concatenated.
  if ('query' === where) {
    return `
    if apikey.nil? || (apikey.is_a?(String) && (apikey == NOT_FOUND || apikey == ""))
      ${clear}
    else
      apikey_val = apikey.is_a?(String) ? apikey : ""
      # NO PREFIX IN A QUERY STRING: \`?token=Bearer%20abc\` is not a thing
      # any API reads, so options.auth.prefix is dropped rather than joined.
      query[QUERY_AUTH] = apikey_val
    end
`
  }

  if ('cookie' === where) {
    return `
    # Dropped before writing, so a retry cannot accumulate the pair and a
    # withdrawn credential leaves no stale cookie behind.
    ${clear}

    unless apikey.nil? || (apikey.is_a?(String) && (apikey == NOT_FOUND || apikey == ""))
      apikey_val = apikey.is_a?(String) ? apikey : ""
      # A cookie IS a header, so the pair is appended to the cookie header
      # rather than clobbering it. No prefix: \`token=Bearer abc\` is not a
      # cookie value any API reads.
      existing = headers[HEADER_COOKIE]
      pair = "#{COOKIE_AUTH}=#{apikey_val}"
      headers[HEADER_COOKIE] =
        (existing.is_a?(String) && !existing.empty?) ? "#{existing}; #{pair}" : pair
    end
`
  }

  // HEADER: the template's body, unchanged.
  return `
    if apikey.nil? || (apikey.is_a?(String) && (apikey == NOT_FOUND || apikey == ""))
      ${clear}
    else
      auth_prefix = VoxgigStruct.getpath(options, "auth.prefix") || ""
      apikey_val = apikey.is_a?(String) ? apikey : ""
      # Empty prefix (raw apiKey credential) must not add a leading space.
      headers[HEADER_AUTH] =
        auth_prefix.empty? ? apikey_val : "#{auth_prefix} #{apikey_val}"
    end
`
}


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING (the py port found
// this first; same reasoning, same fix).
//
// `isAuthActive` is false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`). That is a statement about the DEFINITION,
// not a ban on ever sending a credential: apidef writes it for every spec
// with no securitySchemes block, and those SDKs are still expected to honour
// an `apikey` the caller passes. The template placed the credential
// unconditionally, so they did.
//
// Gating the body on `isAuthActive` therefore does not trim dead code, it
// deletes working authentication. MEASURED, not assumed: with the wider gate
// this component emitted the no-op for generatedcompile's own fixture
// (`main: kit: info: { ... auth: false }`) and two running rb lanes went red
// —
//
//   rb: auth null beats an explicit apikey
//     FAIL: baseline broken: an ordinary apikey was not sent
//   rb: the secrets feature runs with the feature active
//     expected the authorization header to carry OPTKEY01, got: nil
//
// So the no-op is emitted only when the PROJECT says so: `config.auth.active:
// false`, an explicit per-SDK switch nobody sets by accident. A spec that is
// merely silent keeps the credential path it has always had.
function authSwitchedOn(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


// A Ruby double-quoted literal. `#` is escaped only where it would OPEN an
// interpolation, matching utility_rb.formatRubyValue.
function rbstr(s: string): string {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/#(?=[{$@])/g, '\\#') + '"'
}


export {
  PrepareAuth
}

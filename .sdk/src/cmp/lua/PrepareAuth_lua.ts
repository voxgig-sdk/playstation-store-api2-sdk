
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
// rather than templated. The lua peer of PrepareAuth_ts.
//
// This was a static file at tm/lua/utility/prepare_auth.lua that hardcoded
// a lower-case "authorization" HEADER. apidef has always resolved the
// scheme's "in" and "name" into main.kit.info.security - joplin's says
// in: "query", name: "token" - and generation dropped both. The result was
// an SDK that sent a header the API does not read and never sent the query
// parameter it does, so it could not authenticate at all. Four repos in
// the cedar fleet shipped that way: joplin (token), pipedrive (api_token),
// trello (key), lm-umbrella (apiKey).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else - no dead query code in a
// bearer-token SDK, and no runtime branch on a value that is fixed at
// generation time.
//
// The header placement renders BYTE-FOR-BYTE what the template rendered,
// so every header-based lua SDK regenerates with a zero diff.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // `!isAuthSuppressed`, NOT `isAuthActive`. The latter is also false when
  // the SPEC merely declares no security scheme (`main.kit.info.auth:
  // false`), and those SDKs still carry a credential: optspec always
  // declares `apikey` and makeOptions fills `options.auth` from its
  // defaults, so the runtime guard never fired and they have always sent
  // it. Only an explicit `main.kit.config.auth.active: false` means "no
  // credential, ever", which is what isAuthSuppressed reads.
  const active = !isAuthSuppressed(model)
  const where = resolveAuthIn(model)
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  // A HEADER NAME IS LOWER-CASED HERE; A QUERY OR COOKIE NAME IS NOT.
  // Every header key the lua SDK writes is lower case (make_spec's
  // "content-type", the secrets feature's "authorization", fetcher's
  // lower-casing of the response headers), and HTTP header names are
  // case-insensitive on the wire - so "Authorization" must arrive here as
  // the "authorization" the rest of the SDK looks up. A query parameter
  // and a cookie name are case-SENSITIVE: lm-umbrella's "apiKey" is not
  // "apikey", and lower-casing it would break exactly the APIs this
  // change exists to fix.
  const cred = resolveAuthName(model)
  const name = 'header' === where ? cred.toLowerCase() : cred

  // FOLDER NESTING. Main_lua opens NO folder around this call: its
  // Folder({name:'.'}) around Config is the target root itself, and the
  // lua tree has no src/ wrapper (tm/lua/src holds only feature
  // placeholders and Main's Copy excludes it). The template lived at
  // tm/lua/utility/prepare_auth.lua, which the blanket Copy lands at
  // <root>/utility/prepare_auth.lua - the one path
  // require("utility.prepare_auth") in utility/register.lua resolves. So
  // this component opens the single "utility" folder that path needs.
  // Opening a second one would write <root>/utility/utility/, where
  // nothing requires it.
  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({
        project: model.const.Name,
        active,
        where,
        name,
        prefix,
        basic,
      }))
    })
  })
})


function render(spec: {
  project: string, active: boolean, where: string,
  name: string, prefix: string, basic: boolean
}): string {
  const head = `-- ${spec.project} SDK utility: prepare_auth\n`

  // NO AUTH AT ALL. A public API's SDK gets a prepare_auth that is honest
  // about it rather than one that deletes a header nobody set.
  if (!spec.active) {
    return head + `
-- This API declares no authentication, so there is no credential to place.
-- The function stays in the pipeline because make_spec calls it
-- unconditionally.
local function prepare_auth_util(ctx)
  local spec = ctx.spec
  if spec == nil then
    return nil, ctx:make_error("auth_no_spec",
      "Expected context spec property to be defined.")
  end

  return spec, nil
end

return prepare_auth_util
`
  }

  const where = spec.where

  // HTTP Basic is header-only by definition: the scheme is
  // "Authorization: Basic base64(user:pass)". It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it
  // can mean something.
  const basic = spec.basic && 'header' === where

  const CRED = credConst(where)

  const consts =
    `local ${CRED} = "${luastr(spec.name)}"\n` +
    ('cookie' === where ? `local HEADER_COOKIE = "cookie"\n` : '') +
    `local OPTION_APIKEY = "apikey"\n` +
    (basic ? `local OPTION_SECRET = "secret"\n` : '') +
    `local NOT_FOUND = "__NOTFOUND__"\n`

  return head + `
local vs = require("utility.struct.struct")

` + consts + (basic ? BASE64 : '') + ('cookie' === where ? COOKIE_SET : '') + `
local function prepare_auth_util(ctx)
  local spec = ctx.spec
  if spec == nil then
    return nil, ctx:make_error("auth_no_spec",
      "Expected context spec property to be defined.")
  end

${bag(where)}  local options = ctx.client:options_map()

  -- Public APIs that need no auth omit the options.auth block entirely.
  if options.auth == nil then
${clear(where, 4)}
    return spec, nil
  end

  local apikey = vs.getprop(options, OPTION_APIKEY, NOT_FOUND)
` + (basic ? BASIC : '') + `
  if apikey == nil
    or (type(apikey) == "string" and (apikey == NOT_FOUND or apikey == ""))
  then
${clear(where, 4)}
  else
${place(where)}
  end

  return spec, nil
end

return prepare_auth_util
`
}


// The constant the credential name is bound to, named for where it goes -
// a reader of the generated file should not have to ask.
function credConst(where: string): string {
  return 'query' === where ? 'QUERY_AUTH' :
    'cookie' === where ? 'COOKIE_AUTH' : 'HEADER_AUTH'
}


// The bag the credential lands in, per placement. A cookie rides the
// header bag, because a cookie IS a header.
function bag(where: string): string {
  return 'query' === where ?
    '  local query = spec.query\n' :
    '  local headers = spec.headers\n'
}


function clear(where: string, indent: number): string {
  const pad = ' '.repeat(indent)

  if ('query' === where) {
    return pad + 'query[QUERY_AUTH] = nil'
  }

  if ('cookie' === where) {
    return pad + 'cookie_set(headers, nil)'
  }

  return pad + 'headers[HEADER_AUTH] = nil'
}


function place(where: string): string {
  if ('query' === where) {
    // NO PREFIX IN A QUERY STRING. "?token=Bearer%20abc" is not a thing any
    // API reads; the prefix is a header-value convention and is dropped
    // here deliberately rather than silently concatenated.
    return `    -- NO PREFIX IN A QUERY STRING: "?token=Bearer%20abc" is not a thing
    -- any API reads, so the auth.prefix a header placement space-joins is
    -- dropped here deliberately rather than concatenated.
    local apikey_val = ""
    if type(apikey) == "string" then
      apikey_val = apikey
    end
    query[QUERY_AUTH] = apikey_val`
  }

  if ('cookie' === where) {
    return `    local apikey_val = ""
    if type(apikey) == "string" then
      apikey_val = apikey
    end
    -- The prefix is a header-value convention and has no meaning in a
    -- cookie pair, so it is dropped the way a query placement drops it.
    cookie_set(headers, apikey_val)`
  }

  // BYTE-FOR-BYTE the template's body, so a header-based SDK regenerates
  // unchanged.
  return `    local auth_prefix = ""
    local ap = vs.getpath(options, "auth.prefix")
    if type(ap) == "string" then
      auth_prefix = ap
    end
    local apikey_val = ""
    if type(apikey) == "string" then
      apikey_val = apikey
    end
    -- Empty prefix (raw apiKey credential) must not add a leading space.
    if auth_prefix == "" then
      headers[HEADER_AUTH] = apikey_val
    else
      headers[HEADER_AUTH] = auth_prefix .. " " .. apikey_val
    end`
}


// True HTTP Basic Auth: two credentials, base64-joined. Emitted only for a
// header placement (see render).
const BASIC = `
  -- True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  -- token in the header (the branch below) can never authenticate against
  -- an API that actually checks "Authorization: Basic base64(user:pass)".
  if vs.getpath(options, "auth.basic") == true then
    local secret = vs.getprop(options, OPTION_SECRET, NOT_FOUND)

    if apikey == nil or secret == nil
      or (type(apikey) == "string" and (apikey == NOT_FOUND or apikey == ""))
      or (type(secret) == "string" and (secret == NOT_FOUND or secret == ""))
    then
      headers[HEADER_AUTH] = nil
    else
      local auth_prefix = ""
      local ap = vs.getpath(options, "auth.prefix")
      if type(ap) == "string" then
        auth_prefix = ap
      end
      local joined = base64(tostring(apikey) .. ":" .. tostring(secret))
      if auth_prefix == "" then
        headers[HEADER_AUTH] = joined
      else
        headers[HEADER_AUTH] = auth_prefix .. " " .. joined
      end
    end

    return spec, nil
  end
`


// Lua 5.4 has no base64, and the vendored sekreto encoder lives inside the
// OPTIONAL secrets feature - an SDK that never asked for secrets does not
// ship it - so an HTTP Basic SDK carries its own. Emitted only in that
// branch, so nothing else pays for it.
const BASE64 = `
local B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


local function base64(text)
  local out = {}
  local size = #text
  local index = 1

  while index <= size do
    local rest = size - index + 1
    local a = string.byte(text, index)
    local b = string.byte(text, index + 1) or 0
    local c = string.byte(text, index + 2) or 0
    local word = (a << 16) | (b << 8) | c

    local chunk = {}
    for shift = 18, 0, -6 do
      local at = (word >> shift) & 0x3f
      chunk[#chunk + 1] = string.sub(B64_ALPHABET, at + 1, at + 1)
    end

    -- One trailing source byte yields two characters and "==", two yield
    -- three and "=".
    if rest == 1 then
      chunk[3] = "="
      chunk[4] = "="
    elseif rest == 2 then
      chunk[4] = "="
    end

    out[#out + 1] = table.concat(chunk)
    index = index + 3
  end

  return table.concat(out)
end

`


// A cookie header is SHARED: any other cookie the caller set rides in the
// same string, so the credential pair is rewritten in place and everything
// else is kept. A plain assignment would throw the caller's cookies away.
// A nil value removes just our pair.
const COOKIE_SET = `
local function cookie_set(headers, value)
  local kept = {}
  local existing = headers[HEADER_COOKIE]

  if type(existing) == "string" then
    for pair in string.gmatch(existing, "[^;]+") do
      local one = string.match(pair, "^%s*(.-)%s*$")
      if one ~= "" and string.match(one, "^[^=]*") ~= COOKIE_AUTH then
        kept[#kept + 1] = one
      end
    end
  end

  if value ~= nil then
    kept[#kept + 1] = COOKIE_AUTH .. "=" .. value
  end

  if #kept == 0 then
    headers[HEADER_COOKIE] = nil
  else
    headers[HEADER_COOKIE] = table.concat(kept, "; ")
  end
end

`


function luastr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  PrepareAuth
}

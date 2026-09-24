
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


const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const active = authSwitchedOn(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const basic = isHttpBasicAuth(model)

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

  const CRED = query ? 'QUERY_AUTH' : cookie ? 'COOKIE_AUTH' : 'HEADER_AUTH'

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


function authSwitchedOn(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


function rbstr(s: string): string {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/#(?=[{$@])/g, '\\#') + '"'
}


export {
  PrepareAuth
}

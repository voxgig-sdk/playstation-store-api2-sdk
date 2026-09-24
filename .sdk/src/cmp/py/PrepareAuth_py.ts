
import {
  Content,
  File,
  Folder,
  cmp,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({
        pkg: model.const.Name.toLowerCase() + '_sdk',
        Name: model.const.Name,
        active: isAuthActive_py(model),
        where: resolveAuthIn(model),
        name: resolveAuthName(model),
        basic: isHttpBasicAuth(model),
        prefix: resolveAuthPrefix(model),
      }))
    })
  })
})


type AuthSpec = {
  pkg: string
  Name: string
  active: boolean
  where: string
  name: string
  basic: boolean
  prefix: string
}


function render(spec: AuthSpec): string {
  const head = `# ${spec.Name} SDK utility: prepare_auth

from __future__ import annotations
`

  // NO AUTH AT ALL - the project switched it off (see isAuthActive_py for
  // why only an EXPLICIT switch counts). The SDK gets a prepare_auth that is
  // honest about it rather than one that pops a header nobody set;
  // voxgig_struct is not imported, because nothing here reads an option.
  if (!spec.active) {
    return head + `

# This SDK is configured with authentication off, so there is no credential
# to place. The function stays in the pipeline because make_spec calls it
# unconditionally.
def prepare_auth_util(ctx):
    spec = ctx.spec
    if spec is None:
        return None, ctx.make_error("auth_no_spec",
            "Expected context spec property to be defined.")

    return spec, None
`
  }

  if ('query' === spec.where) return renderQuery(spec, head)
  if ('cookie' === spec.where) return renderCookie(spec, head)

  return renderHeader(spec, head)
}


function renderHeader(spec: AuthSpec, head: string): string {
  return head + (spec.basic ? `import base64
` : '') + `from ${spec.pkg}.utility.voxgig_struct import voxgig_struct as vs

HEADER_AUTH = ${pystr(headerName(spec.name))}
OPTION_APIKEY = "apikey"
` + (spec.basic ? `OPTION_SECRET = "secret"
` : '') + `NOT_FOUND = "__NOTFOUND__"


def prepare_auth_util(ctx):
    spec = ctx.spec
    if spec is None:
        return None, ctx.make_error("auth_no_spec",
            "Expected context spec property to be defined.")

    headers = spec.headers
    options = ctx.client.options_map()

    # Public APIs that need no auth omit the options.auth block entirely.
    if options.get("auth") is None:
        headers.pop(HEADER_AUTH, None)
        return spec, None

    apikey = vs.getprop(options, OPTION_APIKEY, NOT_FOUND)
` + basicBlock(spec) + `
    if (
        (isinstance(apikey, str) and apikey == NOT_FOUND)
        or apikey is None
        or apikey == ""
    ):
        headers.pop(HEADER_AUTH, None)
    else:
        auth_prefix = ""
        ap = vs.getpath(options, "auth.prefix")
        if isinstance(ap, str):
            auth_prefix = ap
        apikey_val = ""
        if isinstance(apikey, str):
            apikey_val = apikey
        # Empty prefix (raw apiKey credential) must not add a leading space.
        headers[HEADER_AUTH] = (
            auth_prefix + " " + apikey_val if auth_prefix else apikey_val
        )

    return spec, None
`
}


// HTTP Basic is header-only by definition: the scheme is
// `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
// query parameter or a cookie, so the branch is emitted only where it can
// mean something — and only when the model says the scheme IS basic, so an
// ordinary bearer SDK carries no dead code.
function basicBlock(spec: AuthSpec): string {
  if (!spec.basic) return ''

  return `
    # True HTTP Basic Auth needs TWO credentials, base64-joined - a single
    # token in the header (the branch below) can never authenticate against
    # an API that actually checks \`Authorization: Basic base64(user:pass)\`.
    if vs.getpath(options, "auth.basic") is True:
        secret = vs.getprop(options, OPTION_SECRET, NOT_FOUND)
        no_apikey = (
            (isinstance(apikey, str) and apikey == NOT_FOUND)
            or apikey is None
            or apikey == ""
        )
        no_secret = (
            (isinstance(secret, str) and secret == NOT_FOUND)
            or secret is None
            or secret == ""
        )

        if no_apikey or no_secret:
            headers.pop(HEADER_AUTH, None)
        else:
            auth_prefix = ""
            ap = vs.getpath(options, "auth.prefix")
            if isinstance(ap, str):
                auth_prefix = ap
            b64 = base64.b64encode(
                (str(apikey) + ":" + str(secret)).encode("utf-8")
            ).decode("ascii")
            headers[HEADER_AUTH] = (
                auth_prefix + " " + b64 if auth_prefix else b64
            )

        return spec, None
`
}


function renderQuery(spec: AuthSpec, head: string): string {
  return head + `from ${spec.pkg}.utility.voxgig_struct import voxgig_struct as vs

QUERY_AUTH = ${pystr(spec.name)}
OPTION_APIKEY = "apikey"
NOT_FOUND = "__NOTFOUND__"


def prepare_auth_util(ctx):
    spec = ctx.spec
    if spec is None:
        return None, ctx.make_error("auth_no_spec",
            "Expected context spec property to be defined.")

    query = spec.query
    options = ctx.client.options_map()

    # Public APIs that need no auth omit the options.auth block entirely.
    if options.get("auth") is None:
        query.pop(QUERY_AUTH, None)
        return spec, None

    apikey = vs.getprop(options, OPTION_APIKEY, NOT_FOUND)

    if (
        (isinstance(apikey, str) and apikey == NOT_FOUND)
        or apikey is None
        or apikey == ""
    ):
        query.pop(QUERY_AUTH, None)
    else:
        apikey_val = ""
        if isinstance(apikey, str):
            apikey_val = apikey
        # NO PREFIX IN A QUERY STRING. \`?${spec.name}=Bearer%20abc\` is not a
        # thing any API reads: the prefix is a header convention, so it is
        # dropped here deliberately rather than silently concatenated.
        query[QUERY_AUTH] = apikey_val

    return spec, None
`
}


function renderCookie(spec: AuthSpec, head: string): string {
  return head + `from ${spec.pkg}.utility.voxgig_struct import voxgig_struct as vs

COOKIE_HEADER = "cookie"
COOKIE_AUTH = ${pystr(spec.name)}
OPTION_APIKEY = "apikey"
NOT_FOUND = "__NOTFOUND__"


def _cookies_without_cred(headers):
    """The cookie header minus our own pair, every other cookie untouched."""
    existing = headers.get(COOKIE_HEADER)
    if not isinstance(existing, str) or existing == "":
        return ""

    kept = []
    for part in existing.split(";"):
        piece = part.strip()
        if piece == "" or piece == COOKIE_AUTH or piece.startswith(COOKIE_AUTH + "="):
            continue
        kept.append(piece)

    return "; ".join(kept)


def _apply_cookie(headers, value):
    """Set (value) or remove (None) our pair, leaving the rest in place.

    Splicing rather than assigning also makes this idempotent: a retried
    request cannot end up with the credential in the header twice.
    """
    rest = _cookies_without_cred(headers)

    if value is None:
        if rest == "":
            headers.pop(COOKIE_HEADER, None)
        else:
            headers[COOKIE_HEADER] = rest
        return

    pair = COOKIE_AUTH + "=" + value
    headers[COOKIE_HEADER] = rest + "; " + pair if rest else pair


def prepare_auth_util(ctx):
    spec = ctx.spec
    if spec is None:
        return None, ctx.make_error("auth_no_spec",
            "Expected context spec property to be defined.")

    headers = spec.headers
    options = ctx.client.options_map()

    # Public APIs that need no auth omit the options.auth block entirely.
    if options.get("auth") is None:
        _apply_cookie(headers, None)
        return spec, None

    apikey = vs.getprop(options, OPTION_APIKEY, NOT_FOUND)

    if (
        (isinstance(apikey, str) and apikey == NOT_FOUND)
        or apikey is None
        or apikey == ""
    ):
        _apply_cookie(headers, None)
    else:
        apikey_val = ""
        if isinstance(apikey, str):
            apikey_val = apikey
        # NO PREFIX IN A COOKIE either - a cookie carries a bare
        # \`name=value\` pair, not a header's scheme-prefixed credential.
        _apply_cookie(headers, apikey_val)

    return spec, None
`
}


function isAuthActive_py(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


function headerName(name: string): string {
  return String(name).toLowerCase()
}


function pystr(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}


export {
  PrepareAuth
}

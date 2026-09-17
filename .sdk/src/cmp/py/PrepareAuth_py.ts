
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


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated. The py port of cmp/ts/PrepareAuth_ts.ts; see that
// file for the full account.
//
// This was a static file at `tm/py/pkg/utility/prepare_auth.py` that
// hardcoded a lowercase `authorization` header. apidef has always resolved
// the scheme's `in` and `name` into `main.kit.info.security` — joplin's
// says `in: "query", name: "token"` — and generation dropped both, so the
// SDK sent a header the API does not read and never sent the query
// parameter it does.
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // FOLDER NESTING. Main_py already opened the ONE package folder
  // (`<name>_sdk`) that everything the SDK owns lives in, and the blanket
  // `Copy({from: 'tm/py/pkg'})` that used to bring this file in runs inside
  // that same folder — which is why the template's own path,
  // `tm/py/pkg/utility/prepare_auth.py`, lands at
  // `<name>_sdk/utility/prepare_auth.py`. So this component opens exactly
  // ONE segment, `utility`, to reproduce that path. Opening `<name>_sdk`
  // again would write to `<name>_sdk/<name>_sdk/utility/`, which nothing
  // imports, while register.py kept importing the stale copy.
  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({
        // The generated package name, spelled the way Config_py spells it.
        // A Copy applies ctx$.stdrep to the file it copies; Content does
        // not, so the `projectname_sdk` placeholder the template carried
        // has to be resolved here.
        pkg: model.const.Name.toLowerCase() + '_sdk',
        Name: model.const.Name,
        active: isAuthActive_py(model),
        where: resolveAuthIn(model),
        name: resolveAuthName(model),
        basic: isHttpBasicAuth(model),
        // Read so the resolution is visible at generation time even though
        // the emitted code takes the prefix from options at runtime (the
        // secrets feature rewrites it there).
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


// HEADER. Byte-for-byte the old template when the scheme resolves to the
// defaults (header / Authorization), so every header-based SDK regenerates
// unchanged — only the constant's VALUE moves with the model, plus the
// HTTP Basic block, which is emitted only for a basic scheme.
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


// QUERY. The credential is a query parameter, so it goes in spec.query and
// the headers are never touched.
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


// COOKIE. A cookie IS a header, so the credential rides the header bag -
// but the `cookie` header is SHARED with whatever cookies the caller set,
// so the pair is spliced in and out rather than the header assigned over.
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


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING. That helper is
// false whenever the SPEC declares no security scheme (`main.kit.info.auth:
// false`) — which is a statement about the DEFINITION, not a ban on ever
// sending a credential. apidef writes it for every spec with no
// securitySchemes block, GitHub's official OpenAPI included, and those SDKs
// are still expected to honour an `apikey` the caller passes; the old
// template placed the credential unconditionally, so they did.
//
// Gating the body on `isAuthActive` therefore does not just trim dead code,
// it removes working authentication from every such SDK. The generated
// suite catches it: generatedcompile's `py: auth null beats an explicit
// apikey` lane generates against a fixture that declares
// `main: kit: info: { ... auth: false }` and then requires
// `wire({apikey: 'OPTKEY01'})` to reach the transport as an authorization
// header. With the wider gate it reports
//
//   FAIL: baseline broken: an ordinary apikey was not sent:
//         {'called': True, 'had': False, 'val': None}
//
// So the no-op is emitted only when the PROJECT says so — `config.auth.active:
// false`, an explicit per-SDK switch nobody sets by accident. A spec that is
// merely silent keeps the credential path it has always had.
function isAuthActive_py(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


// HTTP header names are case-insensitive, and the whole py runtime spells
// them lowercase - the debug feature's redact list, the secrets feature's
// in-place rewrite of `fetchdef["headers"]["authorization"]`, and the
// generated tests all match on the lowercase key. Lowercasing here keeps
// the default byte-identical to the old template AND keeps a custom header
// name (`X-API-Key`) findable by all of them.
function headerName(name: string): string {
  return String(name).toLowerCase()
}


function pystr(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}


export {
  PrepareAuth
}

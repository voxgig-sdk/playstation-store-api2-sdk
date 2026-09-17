
import {
  Content,
  File,
  Folder,
  cmp,
  goModule,
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
// rather than templated. This is the go peer of PrepareAuth_ts; read that
// one first, it carries the full account of the defect.
//
// This was a static file at `tm/go/utility/prepare_auth.go` that hardcoded
//
//   const headerAuth = "authorization"
//
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both, so the SDK sent a header the API does not
// read and never sent the query parameter it does.
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value fixed at generation
// time. Go makes that stricter than most targets: an unused local is a
// COMPILE ERROR, so a file that resolved `authPrefix` and then dropped it
// for a query placement would not build at all.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // The generated source cannot use the `GOMODULE` / `github.com/voxgig/struct`
  // placeholders: those are rewritten by Main's `Copy({from:'tm/go'})`, and
  // this file never travels through that Copy. The real import paths go in
  // here, the same way EntityTypes_go resolves them.
  const gomodule = goModule(model, target.name)

  const active = isAuthActive_go(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  // FOLDER NESTING. Main_go opens NO folder around this call: go's layout is
  // flat at the target root (core/, utility/, feature/, entity/, test/), the
  // template this replaces lived at `tm/go/utility/prepare_auth.go`, and
  // `Copy({from:'tm/go'})` lands it at `<root>/utility/`. So the `utility`
  // folder is opened HERE, exactly as EntityTypes_go opens `entity`.
  //
  // The call site matters as much: Config is inside `Folder({name:'core'})`,
  // and putting PrepareAuth beside it would write `core/utility/prepare_auth.go`
  // — a second `package utility` nobody imports, while the registrar keeps
  // calling whatever `utility/` still holds. Main_go calls this at ROOT level.
  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({ gomodule, active, where, name, prefix, basic }))
    })
  })
})


type AuthSpec = {
  gomodule: string
  active: boolean
  where: string
  name: string
  prefix: string
  basic: boolean
}


function render(spec: AuthSpec): string {

  // NO AUTH AT ALL. A public API's SDK gets a prepareAuth that is honest
  // about it rather than one that deletes a header nobody set. `vs` is left
  // out of the imports deliberately — go rejects an unused import.
  if (!spec.active) {
    return `package utility

import (
	"${spec.gomodule}/core"
)

// This API declares no authentication, so there is no credential to place.
// The function stays in the pipeline because makeSpec calls it
// unconditionally.
func prepareAuthUtil(ctx *core.Context) (*core.Spec, error) {
	spec := ctx.Spec
	if spec == nil {
		return nil, ctx.MakeError("auth_no_spec",
			"Expected context spec property to be defined.")
	}

	return spec, nil
}
`
  }

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it can
  // mean something — and base64 is imported only then.
  const withBasic = spec.basic && 'header' === spec.where

  const head = `package utility

import (
${withBasic ? `	"encoding/base64"

` : ''}	vs "${spec.gomodule}/utility/struct"

	"${spec.gomodule}/core"
)

const credName = "${gostr(credLiteral(spec.where, spec.name))}"
${'cookie' === spec.where ? `const cookieHeader = "cookie"
` : ''}const optionApikey = "apikey"
${withBasic ? `const optionSecret = "secret"
` : ''}const notFound = "__NOTFOUND__"

func prepareAuthUtil(ctx *core.Context) (*core.Spec, error) {
	spec := ctx.Spec
	if spec == nil {
		return nil, ctx.MakeError("auth_no_spec",
			"Expected context spec property to be defined.")
	}

	${bagName(spec.where)} := spec.${bagField(spec.where)}
	options := ctx.Client.OptionsMap()

	// Public APIs that need no auth omit the options.auth block entirely.
	if options["auth"] == nil {
		${clear(spec.where)}
		return spec, nil
	}

	apikey := vs.GetProp(options, optionApikey, notFound)

	skip := false
	if apikey == nil {
		skip = true
	} else if apikeyStr, ok := apikey.(string); ok &&
		(apikeyStr == notFound || apikeyStr == "") {
		skip = true
	}
`

  const basicBlock = !withBasic ? '' : `
	// True HTTP Basic Auth needs TWO credentials, base64-joined - a single
	// token in the header (the branch below) can never authenticate against
	// an API that actually checks \`Authorization: Basic base64(user:pass)\`.
	if basicAuth, _ := vs.GetPath(options, []any{"auth", "basic"}).(bool); basicAuth {
		secret := vs.GetProp(options, optionSecret, notFound)

		noSecret := false
		if secret == nil {
			noSecret = true
		} else if secretStr, ok := secret.(string); ok &&
			(secretStr == notFound || secretStr == "") {
			noSecret = true
		}

		if skip || noSecret {
			${clear(spec.where)}
		} else {
			apikeyVal, _ := apikey.(string)
			secretVal, _ := secret.(string)
			b64 := base64.StdEncoding.EncodeToString([]byte(apikeyVal + ":" + secretVal))

			basicPrefix := ""
			if ap := vs.GetPath(options, []any{"auth", "prefix"}); ap != nil {
				basicPrefix, _ = ap.(string)
			}
			// Empty prefix (raw apiKey credential) must not add a leading space.
			if basicPrefix == "" {
				${bagName(spec.where)}[credName] = b64
			} else {
				${bagName(spec.where)}[credName] = basicPrefix + " " + b64
			}
		}

		return spec, nil
	}
`

  return head + basicBlock + `
	if skip {
		${clear(spec.where)}
	} else {
${place(spec.where)}
	}

	return spec, nil
}
`
}


// The credential's key, as it goes into the bag.
//
// A HEADER name is lowercased. HTTP header names are case-insensitive
// (RFC 9110 5.1) and go's `req.Header.Set` canonicalises on the wire, so
// nothing changes over the socket — but this SDK's own header map is keyed
// in lowercase throughout (`content-type`, and the `authorization` that the
// generated pipeline/feature/secrets tests assert on), and the shipped
// `prepare_auth.go` said `"authorization"`. Emitting the resolver's
// title-cased default here would have left every header SDK's own test
// suite failing on a purely cosmetic difference.
//
// A QUERY parameter and a COOKIE name are case-SENSITIVE, so those go in
// verbatim: `?token=` is not `?Token=`.
function credLiteral(where: string, name: string): string {
  return 'header' === where ? String(name).toLowerCase() : String(name)
}


// The bag the credential lands in, per placement. Cookies ride the header
// bag because a cookie IS a header.
function bagName(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


function bagField(where: string): string {
  return 'query' === where ? 'Query' : 'Headers'
}


function clear(where: string): string {
  return `delete(${bagName(where)}, credName)`
}


function place(where: string): string {
  if ('query' === where) {
    // NO PREFIX IN A QUERY STRING. `?token=Bearer%20abc` is not a thing any
    // API reads; the prefix is a header convention and is dropped here
    // deliberately rather than silently concatenated.
    return `		apikeyVal := ""
		if av, ok := apikey.(string); ok {
			apikeyVal = av
		}
		query[credName] = apikeyVal`
  }

  if ('cookie' === where) {
    // Append, never replace: the cookie header may already carry pairs this
    // SDK did not set, and clobbering it would drop them.
    return `		apikeyVal := ""
		if av, ok := apikey.(string); ok {
			apikeyVal = av
		}
		pair := credName + "=" + apikeyVal
		existing := ""
		if ec, ok := headers[cookieHeader].(string); ok {
			existing = ec
		}
		if existing == "" {
			headers[cookieHeader] = pair
		} else {
			headers[cookieHeader] = existing + "; " + pair
		}`
  }

  return `		authPrefix := ""
		if ap := vs.GetPath(options, []any{"auth", "prefix"}); ap != nil {
			authPrefix, _ = ap.(string)
		}
		apikeyVal := ""
		if av, ok := apikey.(string); ok {
			apikeyVal = av
		}
		// Empty prefix (raw apiKey credential) must not add a leading space.
		if authPrefix == "" {
			headers[credName] = apikeyVal
		} else {
			headers[credName] = authPrefix + " " + apikeyVal
		}`
}


function gostr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  PrepareAuth
}


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING. That helper is
// also false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`) — a statement about the DEFINITION, not a
// ban on ever sending a credential. `optspec` still declares `apikey` and
// makeOptions fills `options.auth` from its defaults, so the runtime
// `options.auth == null` guard never fired and those SDKs have always sent
// the credential. Gating the body on `isAuthActive` does not trim dead
// code, it removes working authentication — which
// `go: auth null suppresses the credential` catches, and which takes the
// secrets feature down with it.
//
// `main.kit.config.auth.active: false` is the project saying "no credential,
// ever", and it is the only signal that can be honoured before runtime.
function isAuthActive_go(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}

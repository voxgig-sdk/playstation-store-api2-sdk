
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

` : ''}${'cookie' === spec.where ? `	"strings"

` : ''}	vs "${spec.gomodule}/utility/struct"

	"${spec.gomodule}/core"
)

const credName = "${gostr(credLiteral(spec.where, spec.name))}"
${'cookie' === spec.where ? `const cookieHeader = "cookie"
` : ''}const optionApikey = "apikey"
${withBasic ? `const optionSecret = "secret"
` : ''}const notFound = "__NOTFOUND__"

${cookieHelper(spec.where)}func prepareAuthUtil(ctx *core.Context) (*core.Spec, error) {
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


// A cookie has no header of its own: place() writes it into `cookie` as
// `credName=value`, so clear() must free that slot, not credName.
function clear(where: string): string {
  if ('cookie' === where) {
    return `cookieSet(headers, nil)`
  }

  return `delete(${bagName(where)}, credName)`
}


function cookieHelper(where: string): string {
  if ('cookie' !== where) {
    return ''
  }

  return `func cookieSet(headers map[string]any, value any) {
	kept := []string{}

	if existing, ok := headers[cookieHeader].(string); ok && existing != "" {
		for _, part := range strings.Split(existing, ";") {
			piece := strings.TrimSpace(part)
			if piece == "" || piece == credName ||
				strings.HasPrefix(piece, credName+"=") {
				continue
			}
			kept = append(kept, piece)
		}
	}

	if value != nil {
		valStr, _ := value.(string)
		kept = append(kept, credName+"="+valStr)
	}

	if len(kept) == 0 {
		delete(headers, cookieHeader)
	} else {
		headers[cookieHeader] = strings.Join(kept, "; ")
	}
}

`
}


function place(where: string): string {
  if ('query' === where) {
    return `		apikeyVal := ""
		if av, ok := apikey.(string); ok {
			apikeyVal = av
		}
		query[credName] = apikeyVal`
  }

  if ('cookie' === where) {
    return `		apikeyVal := ""
		if av, ok := apikey.(string); ok {
			apikeyVal = av
		}
		cookieSet(headers, apikeyVal)`
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


function isAuthActive_go(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}

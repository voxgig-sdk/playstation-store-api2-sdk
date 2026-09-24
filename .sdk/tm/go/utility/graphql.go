package utility

import (
	"strconv"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)


const GraphqlContentType = "application/json"

// Map a GraphQL error to the same error codes the HTTP path produces, so a
// caller handles auth or rate limiting identically on both transports.
// Servers put the machine-readable code in `extensions.code`; Linear-style
// APIs use `extensions.type`.
func graphqlErrorCodeUtil(gqlerr any) string {
	ext, _ := vs.GetProp(gqlerr, "extensions").(map[string]any)

	raw, _ := vs.GetProp(ext, "code").(string)
	if raw == "" {
		raw, _ = vs.GetProp(ext, "type").(string)
	}
	raw = strings.ToUpper(raw)

	if strings.Contains(raw, "AUTH") || strings.Contains(raw, "FORBIDDEN") ||
		strings.Contains(raw, "UNAUTHENTICATED") {
		return "request_auth"
	}
	if strings.Contains(raw, "RATELIMIT") || strings.Contains(raw, "RATE_LIMIT") ||
		strings.Contains(raw, "TOO_MANY") {
		return "request_ratelimit"
	}
	if strings.Contains(raw, "BAD_USER_INPUT") || strings.Contains(raw, "VALIDATION") ||
		strings.Contains(raw, "INVALID") {
		return "request_invalid"
	}

	return "request_graphql"
}

func graphqlBodyUtil(ctx *core.Context) any {
	gql, _ := vs.GetProp(ctx.Point, "graphql").(map[string]any)
	if gql == nil {
		return nil
	}

	// reqmatch/reqdata hold the caller's arguments for THIS call; data/match
	// hold the entity's current state. Which pair depends on whether the op
	// takes match or data input. A named variable falls back to the current
	// state, so updating a loaded entity with just {title} still binds the
	// stored id the mutation requires.
	reqsrc, datasrc := ctx.Reqmatch, ctx.Match
	if ctx.Op != nil && ctx.Op.Input == "data" {
		reqsrc, datasrc = ctx.Reqdata, ctx.Data
	}
	if reqsrc == nil {
		reqsrc = map[string]any{}
	}
	if datasrc == nil {
		datasrc = map[string]any{}
	}

	variables := map[string]any{}

	varlist, _ := vs.GetProp(gql, "vars").([]any)
	for _, v := range varlist {
		spec, _ := v.(map[string]any)
		if spec == nil {
			continue
		}

		name, _ := vs.GetProp(spec, "name").(string)
		from, _ := vs.GetProp(spec, "from").(string)

		if from == "" {
			// The input object IS the request body. Strip the action
			// selector, which is an SDK-side point discriminator, not an
			// API field.
			body := map[string]any{}
			for k, val := range reqsrc {
				if k != "$action" {
					body[k] = val
				}
			}
			variables[name] = body
			continue
		}

		val := vs.GetProp(reqsrc, from)
		if val == nil {
			val = vs.GetProp(datasrc, from)
		}
		if val != nil {
			variables[name] = val
		}
	}

	doc, _ := vs.GetProp(gql, "doc").(string)

	return map[string]any{
		"query":     doc,
		"variables": variables,
	}
}

func graphqlErrorsUtil(ctx *core.Context) bool {
	if ctx.Result == nil || ctx.Point == nil {
		return false
	}

	kind, _ := vs.GetProp(ctx.Point, "kind").(string)
	if kind != "graphql" {
		return false
	}

	errlist, _ := vs.GetProp(ctx.Result.Body, "errors").([]any)
	if len(errlist) == 0 {
		return false
	}

	first := errlist[0]
	msg, _ := vs.GetProp(first, "message").(string)
	if msg == "" {
		msg = "graphql error"
	}
	if len(errlist) > 1 {
		msg = msg + " (+" + strconv.Itoa(len(errlist)-1) + " more)"
	}

	ctx.Result.Err = ctx.MakeError(graphqlErrorCodeUtil(first), "graphql: "+msg)
	ctx.Result.Ok = false

	return true
}


package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func makeSpecUtil(ctx *core.Context) (*core.Spec, error) {
	if ctx.Out["spec"] != nil {
		if sp, ok := ctx.Out["spec"].(*core.Spec); ok {
			ctx.Spec = sp
			return sp, nil
		}
	}

	point := ctx.Point
	options := ctx.Options
	utility := ctx.Utility

	base, _ := vs.GetProp(options, "base").(string)
	prefix, _ := vs.GetProp(options, "prefix").(string)
	suffix, _ := vs.GetProp(options, "suffix").(string)

	var parts []any
	if p := vs.GetProp(point, "parts"); p != nil {
		if pl, ok := p.([]any); ok {
			parts = pl
		}
	}

	ctx.Spec = core.NewSpec(map[string]any{
		"base":   base,
		"prefix": prefix,
		"parts":  parts,
		"suffix": suffix,
		"step":   "start",
	})

	ctx.Spec.Method = utility.PrepareMethod(ctx)

	allowMethod, _ := vs.GetPath(options, []any{"allow", "method"}).(string)
	if !strings.Contains(allowMethod, ctx.Spec.Method) {
		return nil, ctx.MakeError("spec_method_allow",
			"Method \""+ctx.Spec.Method+
				"\" not allowed by SDK option allow.method value: \""+allowMethod+"\"")
	}

	ctx.Spec.Params = utility.PrepareParams(ctx)
	ctx.Spec.Query = utility.PrepareQuery(ctx)
	ctx.Spec.Headers = utility.PrepareHeaders(ctx)

	kind, _ := vs.GetProp(point, "kind").(string)

	if kind == "graphql" {
		// GraphQL addresses one endpoint: no path parts, no query string,
		// and the body carries the operation. PrepareBody is skipped
		// deliberately — it only emits a body for data-input ops, whereas
		// every GraphQL op posts one, including load/list/remove.
		ctx.Spec.Body = utility.GraphqlBody(ctx)
		ctx.Spec.Path = ""
		// PrepareQuery already copied the op's match arguments into the
		// query string. Those same values are bound as operation
		// variables, so leaving them would send /graphql?id=i1.
		ctx.Spec.Query = map[string]any{}
		ctx.Spec.Headers["content-type"] = GraphqlContentType
	} else {
		ctx.Spec.Body = utility.PrepareBody(ctx)

		// A failed request transform has nowhere else to report: the
		// PrepareBody seam returns a plain value, and go's makeError RETURNS
		// the error where the TS reference THROWS it, unwinding the operation
		// from inside transformRequest. So the abort lands here. Without it
		// the error object travels on as the request body and the call still
		// goes out — a 200 would then make a failed transform look like a
		// successful operation.
		//
		// Only the throwing path produces an error value: with ctrl.throw
		// false, makeError hands back result.Resdata instead, and the
		// pipeline continues, exactly as it does in ts.
		if berr, isErr := ctx.Spec.Body.(error); isErr {
			return nil, berr
		}

		ctx.Spec.Path = utility.PreparePath(ctx)
	}

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["spec"] = ctx.Spec
	}

	spec, err := utility.PrepareAuth(ctx)
	if err != nil {
		return nil, err
	}

	ctx.Spec = spec
	return spec, nil
}

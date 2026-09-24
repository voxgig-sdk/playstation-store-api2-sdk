package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func transformRequestUtil(ctx *core.Context) any {
	spec := ctx.Spec
	point := ctx.Point

	if spec != nil {
		spec.Step = "reqform"
	}

	transform := core.ToMapAny(vs.GetProp(point, "transform"))
	if transform == nil {
		return stripAction(ctx.Reqdata)
	}

	reqform := vs.GetProp(transform, "req")
	if reqform == nil {
		return stripAction(ctx.Reqdata)
	}

	reqdata, terr := vs.Transform(map[string]any{
		"reqdata": ctx.Reqdata,
	}, reqform)

	if terr != nil {
		if ctx.Ctrl != nil && ctx.Ctrl.Throw != nil && !*ctx.Ctrl.Throw {
			out, _ := makeErrorUtil(ctx, terr)
			return out
		}
		return terr
	}

	return stripAction(reqdata)
}

// `$action` selects the point (see makePointUtil); it is never an API field,
// so the body is a copy without it. The caller's map is left untouched.
func stripAction(reqdata any) any {
	src, ok := reqdata.(map[string]any)
	if !ok {
		return reqdata
	}
	if _, has := src["$action"]; !has {
		return reqdata
	}
	body := make(map[string]any, len(src))
	for k, v := range src {
		if k != "$action" {
			body[k] = v
		}
	}
	return body
}

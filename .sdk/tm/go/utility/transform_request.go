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
		return ctx.Reqdata
	}

	reqform := vs.GetProp(transform, "req")
	if reqform == nil {
		return ctx.Reqdata
	}

	// Transform gained an error return in struct go 0.1.3. The TS reference
	// wraps this call in try/catch and returns makeError(ctx, err) — but ts's
	// makeError THROWS unless ctrl.throw is false, so that `return` is only
	// ever reached on the non-throwing path. go's makeError cannot throw; it
	// returns the error instead. Handing that back as the `any` this seam
	// returns would make it the request BODY, so makeSpec re-raises it (see
	// the abort there). On the ctrl.throw-false path makeError yields
	// result.Resdata and this returns a real value, as ts does.
	reqdata, terr := vs.Transform(map[string]any{
		"reqdata": ctx.Reqdata,
	}, reqform)

	if terr != nil {
		// Only the NON-throwing path goes through makeError here. With
		// ctrl.throw false, ts's makeError returns result.resdata and the
		// pipeline continues with it as the body; mirror that.
		//
		// On the throwing path the error is handed back raw, for makeSpec to
		// re-raise and the operation to process once. Calling makeError here
		// as well would report the same failure TWICE — it fires the
		// PreUnexpected hook, and the operation fires it again when it
		// handles what makeSpec re-raised. The built-in observability
		// features happen to dedupe on a per-context marker, but a
		// project-supplied feature may legitimately count or log on every
		// dispatch, and ts dispatches once.
		if ctx.Ctrl != nil && ctx.Ctrl.Throw != nil && !*ctx.Ctrl.Throw {
			out, _ := makeErrorUtil(ctx, terr)
			return out
		}
		return terr
	}

	return reqdata
}

package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func transformResponseUtil(ctx *core.Context) any {
	spec := ctx.Spec
	result := ctx.Result
	point := ctx.Point

	if spec != nil {
		spec.Step = "resform"
	}

	if result == nil || !result.Ok {
		return nil
	}

	transform := core.ToMapAny(vs.GetProp(point, "transform"))
	if transform == nil {
		return nil
	}

	resform := vs.GetProp(transform, "res")
	if resform == nil {
		return nil
	}

	// Transform gained an error return in struct go 0.1.3. Both callers
	// (makeResponse, makeResult) DISCARD this function's return value, so an
	// error handed back that way would vanish. The convention they do honour
	// is result.Err — makeResponse sets result.Ok only when it is nil, and
	// GraphqlErrors reports the same way — so report there.
	resdata, terr := vs.Transform(map[string]any{
		"ok":         result.Ok,
		"status":     result.Status,
		"statusText": result.StatusText,
		"headers":    result.Headers,
		"body":       result.Body,
		"err":        result.Err,
		"resdata":    result.Resdata,
		"resmatch":   result.Resmatch,
	}, resform)

	if terr != nil {
		// Ok must be cleared as well as Err. This runs from BOTH makeResponse
		// and makeResult, and only the makeResult call actually reaches the
		// transform: resultBasic never sets Ok, so the makeResponse call
		// returns at the !result.Ok guard above, and makeResponse then sets
		// Ok true. By the time the transform really runs, Ok is already true —
		// and doneUtil returns result.Resdata whenever Ok is true, without
		// ever consulting Err. Recording only the error would leave a failed
		// response transform resolving successfully.
		result.Err = ctx.MakeError("resform", "resform: "+terr.Error())
		result.Ok = false
		return nil
	}

	result.Resdata = resdata
	return resdata
}

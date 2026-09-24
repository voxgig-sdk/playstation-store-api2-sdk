package utility

import "GOMODULE/core"

func featureAddUtil(ctx *core.Context, f core.Feature) {
	client := ctx.Client
	features := client.Features

	var fopts map[string]any
	if af, ok := f.(interface{ AddOptions() map[string]any }); ok {
		fopts = af.AddOptions()
	}

	if fopts != nil {
		before, _ := fopts["__before__"].(string)
		after, _ := fopts["__after__"].(string)
		replace, _ := fopts["__replace__"].(string)

		if "" != before || "" != after || "" != replace {
			for i, ef := range features {
				name := ef.GetName()
				if before == name {
					client.Features = append(features[:i],
						append([]core.Feature{f}, features[i:]...)...)
					return
				}
				if after == name {
					client.Features = append(features[:i+1],
						append([]core.Feature{f}, features[i+1:]...)...)
					return
				}
				if replace == name {
					features[i] = f
					client.Features = features
					return
				}
			}
		}
	}

	client.Features = append(features, f)
}

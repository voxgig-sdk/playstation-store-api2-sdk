package core

import (
	"sync"
)

// MakeConfig builds a fresh, fully materialised config map. Every call
// rebuilds the whole structure, so prefer SharedConfig unless you need a
// private copy you intend to mutate.
func MakeConfig() map[string]any {
	return map[string]any{
		"main": map[string]any{
			"name": "PlaystationStoreApi2",
			"slug": "playstation-store-api2",
			"version": "0.0.1",
			"target": "go",
		},
		"feature": map[string]any{
			"ratelimit": map[string]any{
				"options": map[string]any{
					"active": false,
					"burst": 5,
					"rate": 5,
				},
				"optspec": map[string]any{
					"now": "`$FUNCTION`",
					"sleep": "`$FUNCTION`",
				},
				"strict": false,
				"transport": "wrap",
			},
			"retry": map[string]any{
				"options": map[string]any{
					"active": false,
					"factor": 2,
					"maxDelay": 2000,
					"minDelay": 50,
					"retries": 2,
					"statuses": []any{
						408,
						425,
						429,
						500,
						502,
						503,
						504,
					},
				},
				"optspec": map[string]any{
					"jitter": "`$BOOLEAN`",
					"sleep": "`$FUNCTION`",
				},
				"strict": false,
				"transport": "wrap",
			},
			"test": map[string]any{
				"options": map[string]any{
					"active": false,
				},
				"optspec": map[string]any{
					"entity": "`$MAP`",
					"net": "`$MAP`",
				},
				"strict": false,
				"transport": "base",
			},
			"timeout": map[string]any{
				"options": map[string]any{
					"active": false,
					"ms": 30000,
				},
				"optspec": map[string]any{
					"clearTimer": "`$FUNCTION`",
					"setTimer": "`$FUNCTION`",
				},
				"strict": false,
				"transport": "wrap",
			},
		},
		"options": map[string]any{
			"base": "https://store.playstation.com/store/api/chihiro/00_09_000",
			"headers": map[string]any{
				"content-type": "application/json",
			},
			"entity": map[string]any{
				"container": map[string]any{},
			},
		},
		"entity": map[string]any{
			"container": map[string]any{
				"fields": []any{
					map[string]any{
						"name": "age_limit",
						"title": "Age Limit",
						"type": "`$INTEGER`",
						"short": "Age limit for the content",
					},
					map[string]any{
						"name": "attributes",
						"title": "Attributes",
						"type": "`$OBJECT`",
					},
					map[string]any{
						"name": "container_type",
						"title": "Container Type",
						"type": "`$STRING`",
						"short": "Type of container",
					},
					map[string]any{
						"name": "content_origin",
						"title": "Content Origin",
						"type": "`$INTEGER`",
						"short": "Content origin identifier",
					},
					map[string]any{
						"name": "dob_required",
						"title": "Dob Required",
						"type": "`$BOOLEAN`",
						"short": "Whether date of birth is required",
					},
					map[string]any{
						"name": "id",
						"title": "Id",
						"type": "`$STRING`",
						"short": "Container unique identifier",
					},
					map[string]any{
						"name": "images",
						"title": "Images",
						"type": "`$ARRAY`",
					},
					map[string]any{
						"name": "links",
						"title": "Links",
						"type": "`$ARRAY`",
						"short": "List of products in the container",
					},
				},
				"id": map[string]any{
					"field": "id",
					"from": map[string]any{
						"age_limit": "age_limit",
					},
					"name": "id",
					"parts": []any{
						"country",
						"language",
						"age_limit",
						"container_id",
					},
					"sep": "/",
				},
				"name": "container",
				"op": map[string]any{
					"load": map[string]any{
						"input": "data",
						"name": "load",
						"points": []any{
							map[string]any{
								"kind": "http",
								"method": "GET",
								"orig": "/container/{country}/{language}/{age_limit}/{container_id}",
								"segments": []any{
									map[string]any{
										"lit": "container",
									},
									map[string]any{
										"var": "country",
									},
									map[string]any{
										"var": "language",
									},
									map[string]any{
										"var": "age_limit",
									},
									map[string]any{
										"var": "container_id",
									},
								},
								"parts": []any{
									"container",
									"{country}",
									"{language}",
									"{age_limit}",
									"{container_id}",
								},
								"rename": map[string]any{},
								"transform": map[string]any{
									"req": "`reqdata`",
									"res": "`body`",
								},
								"args": map[string]any{
									"params": []any{
										map[string]any{
											"name": "age_limit",
											"orig": "age_limit",
											"type": "`$STRING`",
											"kind": "param",
											"reqd": true,
											"example": "999",
										},
										map[string]any{
											"name": "container_id",
											"orig": "container_id",
											"type": "`$STRING`",
											"kind": "param",
											"reqd": true,
											"example": "STORE-MSF75508-FULLGAMES",
										},
										map[string]any{
											"name": "country",
											"orig": "country",
											"type": "`$STRING`",
											"kind": "param",
											"reqd": true,
											"example": "ch",
										},
										map[string]any{
											"name": "language",
											"orig": "language",
											"type": "`$STRING`",
											"kind": "param",
											"reqd": true,
											"example": "de",
										},
									},
									"query": []any{
										map[string]any{
											"name": "game_content_type",
											"orig": "game_content_type",
											"type": "`$STRING`",
											"kind": "query",
										},
										map[string]any{
											"name": "genre",
											"orig": "genre",
											"type": "`$STRING`",
											"kind": "query",
										},
										map[string]any{
											"name": "platform",
											"orig": "platform",
											"type": "`$STRING`",
											"kind": "query",
										},
										map[string]any{
											"name": "price",
											"orig": "price",
											"type": "`$STRING`",
											"kind": "query",
										},
										map[string]any{
											"name": "release_date",
											"orig": "release_date",
											"type": "`$STRING`",
											"kind": "query",
										},
										map[string]any{
											"name": "size",
											"orig": "size",
											"type": "`$INTEGER`",
											"kind": "query",
											"example": 20,
										},
										map[string]any{
											"name": "sort",
											"orig": "sort",
											"type": "`$STRING`",
											"kind": "query",
											"example": "release_date",
										},
										map[string]any{
											"name": "start",
											"orig": "start",
											"type": "`$INTEGER`",
											"kind": "query",
											"example": 0,
										},
									},
								},
								"select": map[string]any{
									"exist": []any{
										"age_limit",
										"container_id",
										"country",
										"game_content_type",
										"genre",
										"language",
										"platform",
										"price",
										"release_date",
										"size",
										"sort",
										"start",
									},
								},
							},
						},
					},
				},
				"relations": map[string]any{
					"ancestors": []any{},
				},
			},
		},
	}
}

// The plugin definitions the model selected per feature, as []any so a
// feature package can consume them without core naming its types. Empty
// when no active feature declares active plugin groups for this target.
var featurePlugins = map[string][]any{
}

// FeaturePlugins is the definitions list for one feature's chain.
func FeaturePlugins(name string) []any {
	return featurePlugins[name]
}

var (
	sharedConfigOnce sync.Once
	sharedConfigVal  map[string]any
)

// SharedConfig returns the process-wide config, built once on first use.
// The SDK reads the config on every request and never writes to it, so one
// instance is shared by every client rather than rebuilt per client.
//
// The returned map is shared: treat it as read-only. Callers that need to
// mutate should use MakeConfig, which always returns a fresh copy.
func SharedConfig() map[string]any {
	sharedConfigOnce.Do(func() {
		sharedConfigVal = MakeConfig()
	})
	return sharedConfigVal
}

func makeFeature(name string) Feature {
	switch name {
	case "ratelimit":
		if NewRatelimitFeatureFunc != nil {
			return NewRatelimitFeatureFunc()
		}
	case "retry":
		if NewRetryFeatureFunc != nil {
			return NewRetryFeatureFunc()
		}
	case "test":
		if NewTestFeatureFunc != nil {
			return NewTestFeatureFunc()
		}
	case "timeout":
		if NewTimeoutFeatureFunc != nil {
			return NewTimeoutFeatureFunc()
		}
	default:
		if NewBaseFeatureFunc != nil {
			return NewBaseFeatureFunc()
		}
	}
	return nil
}

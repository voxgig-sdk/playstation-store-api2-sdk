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
			"test": map[string]any{
				"options": map[string]any{
					"active": false,
				},
				"transport": "base",
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
						"short": "Age limit for the content",
						"type": "`$INTEGER`",
					},
					map[string]any{
						"name": "attributes",
						"type": "`$OBJECT`",
					},
					map[string]any{
						"name": "container_type",
						"short": "Type of container",
						"type": "`$STRING`",
					},
					map[string]any{
						"name": "content_origin",
						"short": "Content origin identifier",
						"type": "`$INTEGER`",
					},
					map[string]any{
						"name": "dob_required",
						"short": "Whether date of birth is required",
						"type": "`$BOOLEAN`",
					},
					map[string]any{
						"name": "id",
						"short": "Container unique identifier",
						"type": "`$STRING`",
					},
					map[string]any{
						"name": "images",
						"type": "`$ARRAY`",
					},
					map[string]any{
						"name": "links",
						"short": "List of products in the container",
						"type": "`$ARRAY`",
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
								"args": map[string]any{
									"params": []any{
										map[string]any{
											"example": "999",
											"kind": "param",
											"name": "age_limit",
											"orig": "age_limit",
											"reqd": true,
											"type": "`$STRING`",
										},
										map[string]any{
											"example": "STORE-MSF75508-FULLGAMES",
											"kind": "param",
											"name": "container_id",
											"orig": "container_id",
											"reqd": true,
											"type": "`$STRING`",
										},
										map[string]any{
											"example": "ch",
											"kind": "param",
											"name": "country",
											"orig": "country",
											"reqd": true,
											"type": "`$STRING`",
										},
										map[string]any{
											"example": "de",
											"kind": "param",
											"name": "language",
											"orig": "language",
											"reqd": true,
											"type": "`$STRING`",
										},
									},
									"query": []any{
										map[string]any{
											"kind": "query",
											"name": "game_content_type",
											"orig": "game_content_type",
											"type": "`$STRING`",
										},
										map[string]any{
											"kind": "query",
											"name": "genre",
											"orig": "genre",
											"type": "`$STRING`",
										},
										map[string]any{
											"kind": "query",
											"name": "platform",
											"orig": "platform",
											"type": "`$STRING`",
										},
										map[string]any{
											"kind": "query",
											"name": "price",
											"orig": "price",
											"type": "`$STRING`",
										},
										map[string]any{
											"kind": "query",
											"name": "release_date",
											"orig": "release_date",
											"type": "`$STRING`",
										},
										map[string]any{
											"example": 20,
											"kind": "query",
											"name": "size",
											"orig": "size",
											"type": "`$INTEGER`",
										},
										map[string]any{
											"example": "release_date",
											"kind": "query",
											"name": "sort",
											"orig": "sort",
											"type": "`$STRING`",
										},
										map[string]any{
											"example": 0,
											"kind": "query",
											"name": "start",
											"orig": "start",
											"type": "`$INTEGER`",
										},
									},
								},
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
								"transform": map[string]any{
									"req": "`reqdata`",
									"res": "`body`",
								},
								"parts": []any{
									"container",
									"{country}",
									"{language}",
									"{age_limit}",
									"{container_id}",
								},
							},
						},
					},
				},
				"relations": map[string]any{
					"ancestors": []any{
						[]any{
							"container",
						},
					},
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
	case "test":
		if NewTestFeatureFunc != nil {
			return NewTestFeatureFunc()
		}
	default:
		if NewBaseFeatureFunc != nil {
			return NewBaseFeatureFunc()
		}
	}
	return nil
}

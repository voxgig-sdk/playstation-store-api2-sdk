package sdktest

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	sdk "github.com/voxgig-sdk/playstation-store-api2-sdk/go"

	vs "github.com/voxgig-sdk/playstation-store-api2-sdk/go/utility/struct"
)

// PENDING sections are the ones deliberately left empty in the shared corpus
// (.sdk/test/primary/<name>.aon). Everything else MUST contribute cases.
var pendingSections = map[string]bool{
	"fetcher": true, "makeFetchDef": true, "makeResult": true,
	"featureAdd": true, "featureHook": true, "featureInit": true,
}

func TestPrimaryUtility(t *testing.T) {
	client := sdk.TestSDK(nil, nil)
	utility := client.GetUtility()

	// The corpus, through the vendored omni runner (see
	// omniresolver_test.go). Subjects receive omni's native argument list:
	// a ctx entry arrives as args[0], a MAP - omniCtx builds the typed
	// context a generated utility takes, and omniSyncCtx writes the
	// observable ctx state back for `match: {ctx: ...}` assertions.
	runner := MakeRunner(TEST_JSON_FILE, client)
	run, err := runner("primary", nil)
	if err != nil {
		t.Fatalf("Failed to make the corpus runner: %v", err)
	}
	primary := run.Spec
	if primary == nil {
		t.Fatal("primary section not found in test.json")
	}

	// Run one corpus section, failing loudly when it would run ZERO cases.
	// A renamed section, a fixture that failed to compile, or an empty set
	// used to report PASS while running zero assertions - the whole point
	// of a shared oracle lost without a single red test. (The guard lives
	// here rather than in the runner, which is vendored verbatim; the
	// shared corpus is a v0 spec, and v0 tolerates an empty set.)
	runsection := func(t *testing.T, name string, subject any) {
		t.Helper()
		section, _ := primary[name].(map[string]any)
		if section == nil {
			t.Fatalf("test corpus section %q missing - check the name against .sdk/test/primary/", name)
		}
		basic, _ := section["basic"].(map[string]any)
		set, ok := basic["set"].([]any)
		if !ok {
			t.Fatalf("test corpus section %q has no basic.set list - zero cases would run", name)
		}
		if 0 == len(set) && !pendingSections[name] {
			t.Fatalf("test corpus section %q is EMPTY - zero cases would run; "+
				"add cases, or mark the fixture PENDING in .sdk/test/primary/", name)
		}
		run.RunSet(t, basic, subject)
	}

	t.Run("exists", func(t *testing.T) {
		if utility.Clean == nil {
			t.Error("Clean should not be nil")
		}
		if utility.Done == nil {
			t.Error("Done should not be nil")
		}
		if utility.MakeError == nil {
			t.Error("MakeError should not be nil")
		}
		if utility.FeatureAdd == nil {
			t.Error("FeatureAdd should not be nil")
		}
		if utility.FeatureHook == nil {
			t.Error("FeatureHook should not be nil")
		}
		if utility.FeatureInit == nil {
			t.Error("FeatureInit should not be nil")
		}
		if utility.Fetcher == nil {
			t.Error("Fetcher should not be nil")
		}
		if utility.MakeFetchDef == nil {
			t.Error("MakeFetchDef should not be nil")
		}
		if utility.MakeContext == nil {
			t.Error("MakeContext should not be nil")
		}
		if utility.MakeOptions == nil {
			t.Error("MakeOptions should not be nil")
		}
		if utility.MakeRequest == nil {
			t.Error("MakeRequest should not be nil")
		}
		if utility.MakeResponse == nil {
			t.Error("MakeResponse should not be nil")
		}
		if utility.MakeResult == nil {
			t.Error("MakeResult should not be nil")
		}
		if utility.MakePoint == nil {
			t.Error("MakePoint should not be nil")
		}
		if utility.MakeSpec == nil {
			t.Error("MakeSpec should not be nil")
		}
		if utility.MakeUrl == nil {
			t.Error("MakeUrl should not be nil")
		}
		if utility.Param == nil {
			t.Error("Param should not be nil")
		}
		if utility.PrepareAuth == nil {
			t.Error("PrepareAuth should not be nil")
		}
		if utility.PrepareBody == nil {
			t.Error("PrepareBody should not be nil")
		}
		if utility.PrepareHeaders == nil {
			t.Error("PrepareHeaders should not be nil")
		}
		if utility.PrepareMethod == nil {
			t.Error("PrepareMethod should not be nil")
		}
		if utility.PrepareParams == nil {
			t.Error("PrepareParams should not be nil")
		}
		if utility.PreparePath == nil {
			t.Error("PreparePath should not be nil")
		}
		if utility.PrepareQuery == nil {
			t.Error("PrepareQuery should not be nil")
		}
		if utility.ResultBasic == nil {
			t.Error("ResultBasic should not be nil")
		}
		if utility.ResultBody == nil {
			t.Error("ResultBody should not be nil")
		}
		if utility.ResultHeaders == nil {
			t.Error("ResultHeaders should not be nil")
		}
		if utility.TransformRequest == nil {
			t.Error("TransformRequest should not be nil")
		}
		if utility.TransformResponse == nil {
			t.Error("TransformResponse should not be nil")
		}
	})

	t.Run("clean-basic", func(t *testing.T) {
		ctx := makeTestCtx(client, utility, nil)
		val := map[string]any{"key": "secret123", "name": "test"}
		cleaned := utility.Clean(ctx, val)
		if cleaned == nil {
			t.Error("cleaned should not be nil")
		}
	})

	t.Run("done-basic", func(t *testing.T) {
		runsection(t, "done", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			return utility.Done(ctx)
		})
	})

	t.Run("makeError-basic", func(t *testing.T) {
		runsection(t, "makeError", func(args ...any) (any, error) {
			if len(args) == 0 {
				args = []any{map[string]any{}}
			}

			ctx := omniCtx(args[0], client, utility)

			var errval error
			if len(args) > 1 {
				errval = omniErrArg(args[1])
			}

			return utility.MakeError(ctx, errval)
		})
	})

	t.Run("makeError-no-throw", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		f := false
		ctx.Ctrl.Throw = &f
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":      false,
			"resdata": map[string]any{"id": "safe01"},
		})

		out, err := utility.MakeError(ctx, ctx.MakeError("test_code", "test message"))
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
		}
		if outMap, ok := out.(map[string]any); ok {
			if outMap["id"] != "safe01" {
				t.Errorf("expected id=safe01, got: %v", outMap["id"])
			}
		} else {
			t.Errorf("expected map result, got: %T", out)
		}
	})

	t.Run("featureAdd-basic", func(t *testing.T) {
		ctx := makeTestCtx(client, utility, nil)
		startLen := len(client.Features)

		feature := sdk.NewBaseFeature()
		utility.FeatureAdd(ctx, feature)

		if len(client.Features) != startLen+1 {
			t.Errorf("expected %d features, got %d", startLen+1, len(client.Features))
		}
	})

	t.Run("featureHook-basic", func(t *testing.T) {
		hookClient := sdk.TestSDK(nil, nil)
		hookUtility := hookClient.GetUtility()
		ctx := makeTestCtx(hookClient, hookUtility, nil)

		called := false
		hookFeature := &testHookFeature{
			BaseFeature: sdk.NewBaseFeature(),
			hookFn:      func() { called = true },
		}
		hookClient.Features = []sdk.Feature{hookFeature}

		hookUtility.FeatureHook(ctx, "TestHook")
		if !called {
			t.Error("expected TestHook to be called")
		}
	})

	t.Run("featureInit-basic", func(t *testing.T) {
		initClient := sdk.TestSDK(nil, nil)
		initUtility := initClient.GetUtility()
		ctx := makeTestCtx(initClient, initUtility, nil)
		ctx.Options["feature"] = map[string]any{
			"initfeat": map[string]any{"active": true},
		}

		initCalled := false
		feature := &testInitFeature{
			BaseFeature: sdk.NewBaseFeature(),
			name:        "initfeat",
			active:      true,
			initFn:      func() { initCalled = true },
		}

		initUtility.FeatureInit(ctx, feature)
		if !initCalled {
			t.Error("expected init to be called")
		}
	})

	t.Run("featureInit-inactive", func(t *testing.T) {
		initClient := sdk.TestSDK(nil, nil)
		initUtility := initClient.GetUtility()
		ctx := makeTestCtx(initClient, initUtility, nil)
		ctx.Options["feature"] = map[string]any{
			"nofeat": map[string]any{"active": false},
		}

		initCalled := false
		feature := &testInitFeature{
			BaseFeature: sdk.NewBaseFeature(),
			name:        "nofeat",
			active:      false,
			initFn:      func() { initCalled = true },
		}

		initUtility.FeatureInit(ctx, feature)
		if initCalled {
			t.Error("expected init NOT to be called for inactive feature")
		}
	})

	t.Run("fetcher-live", func(t *testing.T) {
		calls := []map[string]any{}
		liveClient := sdk.NewPlaystationStoreApi2SDK(map[string]any{
			// Concrete base: a live construction must satisfy any server
			// variables a templated base URL declares; a literal base
			// sidesteps the requirement.
			"base": "http://localhost:8080",
			"system": map[string]any{
				"fetch": func(url string, fetchdef map[string]any) (map[string]any, error) {
					calls = append(calls, map[string]any{"url": url, "init": fetchdef})
					return map[string]any{"status": 200, "statusText": "OK"}, nil
				},
			},
		})
		liveUtility := liveClient.GetUtility()
		ctx := liveUtility.MakeContext(map[string]any{
			"opname":  "load",
			"client":  liveClient,
			"utility": liveUtility,
		}, nil)

		fetchdef := map[string]any{"method": "GET", "headers": map[string]any{}}
		_, err := liveUtility.Fetcher(ctx, "http://example.com/test", fetchdef)
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
		}
		if len(calls) != 1 {
			t.Errorf("expected 1 call, got %d", len(calls))
		}
		if calls[0]["url"] != "http://example.com/test" {
			t.Errorf("expected url http://example.com/test, got %v", calls[0]["url"])
		}
	})

	t.Run("fetcher-blocked-test-mode", func(t *testing.T) {
		// Create a live SDK then set mode to test (not using TestSDK, which installs test feature)
		blockedClient := sdk.NewPlaystationStoreApi2SDK(map[string]any{
			"base": "http://localhost:8080",
			"system": map[string]any{
				"fetch": func(url string, fetchdef map[string]any) (map[string]any, error) {
					return map[string]any{}, nil
				},
			},
		})
		blockedClient.Mode = "test"

		blockedUtility := blockedClient.GetUtility()
		ctx := blockedUtility.MakeContext(map[string]any{
			"opname":  "load",
			"client":  blockedClient,
			"utility": blockedUtility,
		}, nil)

		fetchdef := map[string]any{"method": "GET", "headers": map[string]any{}}
		_, err := blockedUtility.Fetcher(ctx, "http://example.com/test", fetchdef)
		if err == nil {
			t.Error("expected error for test mode fetch")
		} else if !strings.Contains(err.Error(), "blocked") {
			t.Errorf("expected error containing 'blocked', got: %v", err)
		}
	})

	t.Run("makeContext-basic", func(t *testing.T) {
		runsection(t, "makeContext", func(args ...any) (any, error) {
			if inMap, ok := args[0].(map[string]any); ok {
				ctx := utility.MakeContext(inMap, nil)
				out := map[string]any{
					"id": ctx.Id,
				}
				if ctx.Op != nil {
					out["op"] = map[string]any{
						"name":  ctx.Op.Name,
						"input": ctx.Op.Input,
					}
				}
				return out, nil
			}
			return nil, nil
		})
	})

	t.Run("makeFetchDef-basic", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{
			"base":    "http://localhost:8080",
			"prefix":  "/api",
			"path":    "items/{id}",
			"suffix":  "",
			"params":  map[string]any{"id": "item01"},
			"query":   map[string]any{},
			"headers": map[string]any{"content-type": "application/json"},
			"method":  "GET",
			"step":    "start",
		})
		ctx.Result = sdk.NewResult(map[string]any{})

		fetchdef, err := utility.MakeFetchDef(ctx)
		if err != nil {
			t.Errorf("should not be error: %v", err)
			return
		}
		if fetchdef["method"] != "GET" {
			t.Errorf("expected method GET, got %v", fetchdef["method"])
		}
		url, _ := fetchdef["url"].(string)
		if !strings.Contains(url, "/api/items/item01") {
			t.Errorf("expected url to contain /api/items/item01, got %v", url)
		}
		if fetchdef["headers"].(map[string]any)["content-type"] != "application/json" {
			t.Error("expected content-type header")
		}
		if fetchdef["body"] != nil {
			t.Error("expected nil body")
		}
	})

	t.Run("makeFetchDef-with-body", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{
			"base":    "http://localhost:8080",
			"prefix":  "",
			"path":    "items",
			"suffix":  "",
			"params":  map[string]any{},
			"query":   map[string]any{},
			"headers": map[string]any{},
			"method":  "POST",
			"step":    "start",
			"body":    map[string]any{"name": "test"},
		})
		ctx.Result = sdk.NewResult(map[string]any{})

		fetchdef, err := utility.MakeFetchDef(ctx)
		if err != nil {
			t.Errorf("should not be error: %v", err)
			return
		}
		if fetchdef["method"] != "POST" {
			t.Errorf("expected method POST, got %v", fetchdef["method"])
		}
		bodyStr, ok := fetchdef["body"].(string)
		if !ok {
			t.Errorf("expected body string, got %T", fetchdef["body"])
			return
		}
		if !strings.Contains(bodyStr, "\"name\"") {
			t.Errorf("expected body to contain name, got %v", bodyStr)
		}
	})

	t.Run("makeOptions-basic", func(t *testing.T) {
		runsection(t, "makeOptions", func(args ...any) (any, error) {
			in, _ := args[0].(map[string]any)
			ctx := utility.MakeContext(map[string]any{
				"options": in["options"],
				"config":  in["config"],
			}, nil)
			ctx.Client = client
			ctx.Utility = utility
			return utility.MakeOptions(ctx), nil
		})
	})

	t.Run("makeRequest-basic", func(t *testing.T) {
		runsection(t, "makeRequest", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			ctx.Options = client.OptionsMap()

			_, err := utility.MakeRequest(ctx)
			if err != nil {
				return nil, err
			}

			// Expose response/result existence for the match assertions.
			omniSyncCtx(args[0], ctx)

			return nil, nil
		})
	})

	t.Run("makeResponse-basic", func(t *testing.T) {
		runsection(t, "makeResponse", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)

			_, err := utility.MakeResponse(ctx)
			if err != nil {
				return nil, err
			}

			omniSyncCtx(args[0], ctx)

			return nil, nil
		})
	})

	t.Run("makeResult-basic", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{
			"base":    "http://localhost:8080",
			"prefix":  "/api",
			"path":    "items/{id}",
			"suffix":  "",
			"params":  map[string]any{"id": "item01"},
			"query":   map[string]any{},
			"headers": map[string]any{},
			"method":  "GET",
			"step":    "start",
		})
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":         true,
			"status":     200,
			"statusText": "OK",
			"headers":    map[string]any{},
			"resdata":    map[string]any{"id": "item01", "name": "Test"},
		})

		result, err := utility.MakeResult(ctx)
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
			return
		}
		if result.Status != 200 {
			t.Errorf("expected status 200, got %d", result.Status)
		}
	})

	t.Run("makeResult-no-spec", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = nil
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":         true,
			"status":     200,
			"statusText": "OK",
			"headers":    map[string]any{},
		})

		_, err := utility.MakeResult(ctx)
		if err == nil {
			t.Error("expected error for nil spec")
		}
	})

	t.Run("makeResult-no-result", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "start"})
		ctx.Result = nil

		_, err := utility.MakeResult(ctx)
		if err == nil {
			t.Error("expected error for nil result")
		}
	})

	t.Run("makeSpec-basic", func(t *testing.T) {
		setupOpts := getSpec(primary, "makeSpec", "DEF", "setup", "a")
		specClient := sdk.TestSDK(nil, setupOpts)
		specUtility := specClient.GetUtility()

		runsection(t, "makeSpec", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], specClient, specUtility)
			ctx.Options = specClient.OptionsMap()

			_, err := utility.MakeSpec(ctx)
			if err != nil {
				return nil, err
			}

			omniSyncCtx(args[0], ctx)

			return nil, nil
		})
	})

	// Was one hand-written case (the single-point path) covering one of this
	// utility's seven branches, which is how the corpus fixture came to be
	// marked deferred as "needs a real client". It does not: NewContext
	// rebuilds Op from opname + entity + config, and Options can be supplied
	// literally. Driven from the corpus now, so TS and Go assert the same
	// branches.
	//
	// TS returns the error AS the value; Go returns it as a second result. The
	// corpus says `match: out: code` for both, so the error is normalised to a
	// map carrying its code here rather than forking the fixture per language.
	t.Run("makePoint-basic", func(t *testing.T) {
		runsection(t, "makePoint", func(args ...any) (any, error) {
			ctxmap, _ := args[0].(map[string]any)
			if ctxmap == nil {
				ctxmap = map[string]any{}
			}

			// NewContext resolves Op from the ENTITY NAME, and reaches it
			// through the Entity interface - a literal {name:...} map from the
			// fixture is not one, so entname would be "" and every lookup would
			// miss, reporting point_no_points for all seven cases. TS reads the
			// same field with getprop and accepts the plain map. Swap in the
			// package's minimal Entity so both ports resolve the same op.
			if em, ok := ctxmap["entity"].(map[string]any); ok {
				name, _ := em["name"].(string)
				made := []any{}
				swapped := map[string]any{}
				for k, v := range ctxmap {
					swapped[k] = v
				}
				swapped["entity"] = &plEntity{name: name, made: &made}
				ctxmap = swapped
			}

			ctx := omniCtx(ctxmap, client, utility)
			point, err := utility.MakePoint(ctx)
			if err != nil {
				var sdkErr *sdk.PlaystationStoreApi2Error
				if errors.As(err, &sdkErr) {
					return map[string]any{"code": sdkErr.Code}, nil
				}
				return nil, err
			}
			return point, nil
		})
	})

	t.Run("makeUrl-basic", func(t *testing.T) {
		runsection(t, "makeUrl", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			if ctx.Result == nil {
				ctx.Result = sdk.NewResult(map[string]any{})
			}
			return utility.MakeUrl(ctx)
		})
	})

	t.Run("operator-basic", func(t *testing.T) {
		runsection(t, "operator", func(args ...any) (any, error) {
			in, _ := args[0].(map[string]any)
			op := sdk.NewOperation(in)
			return map[string]any{
				"entity": op.Entity,
				"name":   op.Name,
				"input":  op.Input,
				"points": op.Points,
			}, nil
		})
	})

	t.Run("param-basic", func(t *testing.T) {
		runsection(t, "param", func(args ...any) (any, error) {
			if len(args) < 2 {
				return nil, nil
			}

			ctx := omniCtx(args[0], client, utility)
			paramdef := args[1]

			result := utility.Param(ctx, paramdef)

			// The spec alias mutation is what mark 80 asserts on.
			omniSyncCtx(args[0], ctx)

			return result, nil
		})
	})

	t.Run("prepareAuth-basic", func(t *testing.T) {
		setupOpts := getSpec(primary, "prepareAuth", "DEF", "setup", "a")
		authClient := sdk.TestSDK(nil, setupOpts)
		authUtility := authClient.GetUtility()

		runsection(t, "prepareAuth", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], authClient, authUtility)

			_, err := utility.PrepareAuth(ctx)
			if err != nil {
				return nil, err
			}

			omniSyncCtx(args[0], ctx)

			return nil, nil
		})
	})

	t.Run("prepareBody-basic", func(t *testing.T) {
		runsection(t, "prepareBody", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			return utility.PrepareBody(ctx), nil
		})
	})

	t.Run("prepareHeaders-basic", func(t *testing.T) {
		runsection(t, "prepareHeaders", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			return utility.PrepareHeaders(ctx), nil
		})
	})

	t.Run("prepareMethod-basic", func(t *testing.T) {
		runsection(t, "prepareMethod", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			// An op the API does not define resolves NO method; ts answers
			// undefined there and go answers "" - both are "no value" to
			// the corpus.
			method := utility.PrepareMethod(ctx)
			if "" == method {
				return nil, nil
			}
			return method, nil
		})
	})

	t.Run("prepareParams-basic", func(t *testing.T) {
		runsection(t, "prepareParams", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			return utility.PrepareParams(ctx), nil
		})
	})

	// Was two hand-written cases that had drifted out of the shared corpus
	// (the preparePath fixture shipped as an empty `set: []`). Now driven by
	// the corpus like every other section, so all ports assert the same
	// separator/blank-segment behaviour.
	t.Run("preparePath-basic", func(t *testing.T) {
		runsection(t, "preparePath", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			return utility.PreparePath(ctx), nil
		})
	})

	t.Run("clean-corpus", func(t *testing.T) {
		runsection(t, "clean", func(args ...any) (any, error) {
			if 2 != len(args) {
				return nil, fmt.Errorf("clean: expected 2 args, got %d", len(args))
			}
			ctx := omniCtx(args[0], client, utility)
			return utility.Clean(ctx, args[1]), nil
		})
	})

	t.Run("prepareQuery-basic", func(t *testing.T) {
		runsection(t, "prepareQuery", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)
			return utility.PrepareQuery(ctx), nil
		})
	})

	t.Run("resultBasic-basic", func(t *testing.T) {
		runsection(t, "resultBasic", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)

			result := utility.ResultBasic(ctx)

			out := map[string]any{
				"status":     result.Status,
				"statusText": result.StatusText,
			}
			if result.Err != nil {
				out["err"] = map[string]any{
					"message": result.Err.Error(),
				}
			}

			return out, nil
		})
	})

	t.Run("resultBody-basic", func(t *testing.T) {
		runsection(t, "resultBody", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)

			utility.ResultBody(ctx)

			omniSyncCtx(args[0], ctx)

			return nil, nil
		})
	})

	t.Run("resultHeaders-basic", func(t *testing.T) {
		runsection(t, "resultHeaders", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)

			utility.ResultHeaders(ctx)

			omniSyncCtx(args[0], ctx)

			return nil, nil
		})
	})

	t.Run("transformRequest-basic", func(t *testing.T) {
		runsection(t, "transformRequest", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)

			result := utility.TransformRequest(ctx)

			// The step advance is what the match assertion reads.
			omniSyncCtx(args[0], ctx)

			return result, nil
		})
	})

	t.Run("transformResponse-basic", func(t *testing.T) {
		runsection(t, "transformResponse", func(args ...any) (any, error) {
			ctx := omniCtx(args[0], client, utility)

			result := utility.TransformResponse(ctx)

			omniSyncCtx(args[0], ctx)

			return result, nil
		})
	})
}

// Helper: test hook feature for featureHook test
type testHookFeature struct {
	*sdk.BaseFeature
	hookFn func()
}

func (f *testHookFeature) TestHook(ctx *sdk.Context) {
	if f.hookFn != nil {
		f.hookFn()
	}
}

// Helper: test init feature for featureInit test
type testInitFeature struct {
	*sdk.BaseFeature
	name   string
	active bool
	initFn func()
}

func (f *testInitFeature) GetName() string { return f.name }
func (f *testInitFeature) GetActive() bool { return f.active }
func (f *testInitFeature) Init(ctx *sdk.Context, options map[string]any) {
	if f.initFn != nil {
		f.initFn()
	}
}

// Helper: create basic test context
func makeTestCtx(client *sdk.PlaystationStoreApi2SDK, utility *sdk.Utility, overrides map[string]any) *sdk.Context {
	ctxmap := map[string]any{
		"opname":  "load",
		"client":  client,
		"utility": utility,
	}
	if overrides != nil {
		for k, v := range overrides {
			ctxmap[k] = v
		}
	}
	return utility.MakeContext(ctxmap, client.GetRootCtx())
}

// Helper: create full test context with point and match
func makeTestFullCtx(client *sdk.PlaystationStoreApi2SDK, utility *sdk.Utility) *sdk.Context {
	ctx := makeTestCtx(client, utility, nil)
	ctx.Point = map[string]any{
		"parts":     []any{"items", "{id}"},
		"args":      map[string]any{"params": []any{map[string]any{"name": "id", "reqd": true}}},
		"params":    []any{"id"},
		"alias":     map[string]any{},
		"select":    map[string]any{},
		"active":    true,
		"transform": map[string]any{},
	}
	ctx.Match = map[string]any{"id": "item01"}
	ctx.Reqmatch = map[string]any{"id": "item01"}
	return ctx
}

// useVS prevents unused import error
var _ = vs.Clone

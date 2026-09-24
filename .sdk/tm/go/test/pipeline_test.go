package sdktest


import (
	"regexp"
	"testing"

	sdk "GOMODULE"
)

// plClient builds a client + isolated utility + context factory for
// pipeline utility tests.
func plClient(t *testing.T, sdkopts map[string]any) (*sdk.PlaystationStoreApi2SDK, *sdk.Utility) {
	t.Helper()
	client := sdk.TestSDK(nil, sdkopts)
	return client, client.GetUtility()
}

func plCtx(client *sdk.PlaystationStoreApi2SDK, utility *sdk.Utility, ctrl map[string]any) *sdk.Context {
	ctxmap := map[string]any{
		"opname":  "load",
		"client":  client,
		"utility": utility,
	}
	if ctrl != nil {
		ctxmap["ctrl"] = ctrl
	}
	ctx := utility.MakeContext(ctxmap, client.GetRootCtx())
	return ctx
}

// plEntity is a minimal fake entity for the list-wrap test.
type plEntity struct {
	deleted bool
	name string
	made *[]any
}

func (e *plEntity) GetName() string  { return e.name }
func (e *plEntity) Make() sdk.Entity { return &plEntity{name: e.name, made: e.made} }
func (e *plEntity) Data(args ...any) any {
	if len(args) > 0 && args[0] != nil {
		*e.made = append(*e.made, args[0])
	}
	return nil
}
func (e *plEntity) Match(args ...any) any { return nil }

// Every operation resolves to the entity; `remove` marks it. The fake has
// to satisfy the same interface the real entities do.
func (e *plEntity) MarkDeleted() { e.deleted = true }
func (e *plEntity) Deleted() bool { return e.deleted }

func TestPipelineMakeResponse(t *testing.T) {
	client, utility := plClient(t, nil)

	t.Run("guards-missing-spec-response-result", func(t *testing.T) {
		ctx := plCtx(client, utility, nil)
		ctx.Spec = nil
		ctx.Response = sdk.NewResponse(map[string]any{})
		ctx.Result = sdk.NewResult(map[string]any{})
		if _, err := utility.MakeResponse(ctx); fhErrCode(err) != "response_no_spec" {
			t.Errorf("expected response_no_spec, got %v", err)
		}

		ctx = plCtx(client, utility, nil)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Response = nil
		ctx.Result = sdk.NewResult(map[string]any{})
		if _, err := utility.MakeResponse(ctx); fhErrCode(err) != "response_no_response" {
			t.Errorf("expected response_no_response, got %v", err)
		}

		ctx = plCtx(client, utility, nil)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Response = sdk.NewResponse(map[string]any{})
		ctx.Result = nil
		if _, err := utility.MakeResponse(ctx); fhErrCode(err) != "response_no_result" {
			t.Errorf("expected response_no_result, got %v", err)
		}
	})

	t.Run("4xx-sets-result-err-and-copies-headers", func(t *testing.T) {
		ctx := plCtx(client, utility, nil)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Response = sdk.NewResponse(fhResponse(404, nil, map[string]any{"x-a": "1"}))
		ctx.Result = sdk.NewResult(map[string]any{})
		if _, err := utility.MakeResponse(ctx); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ctx.Result.Err == nil {
			t.Error("expected result.Err set on 4xx")
		}
		if ctx.Result.Status != 404 {
			t.Errorf("expected 404, got %d", ctx.Result.Status)
		}
		if ctx.Result.Headers["x-a"] != "1" {
			t.Errorf("expected header copied, got %v", ctx.Result.Headers)
		}
	})

	t.Run("2xx-parses-body-and-marks-ok", func(t *testing.T) {
		ctx := plCtx(client, utility, nil)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Response = sdk.NewResponse(fhResponse(200, map[string]any{"v": 1}, nil))
		ctx.Result = sdk.NewResult(map[string]any{})
		if _, err := utility.MakeResponse(ctx); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !ctx.Result.Ok {
			t.Error("expected ok result")
		}
		body, _ := ctx.Result.Body.(map[string]any)
		if body == nil || body["v"] != 1 {
			t.Errorf("expected parsed body, got %v", ctx.Result.Body)
		}
	})

	t.Run("records-to-ctrl-explain", func(t *testing.T) {
		ctx := plCtx(client, utility, map[string]any{"explain": map[string]any{}})
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Response = sdk.NewResponse(fhResponse(200, map[string]any{"v": 2}, nil))
		ctx.Result = sdk.NewResult(map[string]any{})
		if _, err := utility.MakeResponse(ctx); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ctx.Ctrl.Explain["result"] == nil {
			t.Error("expected explain.result recorded")
		}
	})
}

func TestPipelineMakeResult(t *testing.T) {
	client, utility := plClient(t, nil)

	t.Run("guards-missing-spec-result", func(t *testing.T) {
		ctx := plCtx(client, utility, nil)
		ctx.Spec = nil
		ctx.Result = sdk.NewResult(map[string]any{})
		if _, err := utility.MakeResult(ctx); fhErrCode(err) != "result_no_spec" {
			t.Errorf("expected result_no_spec, got %v", err)
		}

		ctx = plCtx(client, utility, nil)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Result = nil
		if _, err := utility.MakeResult(ctx); fhErrCode(err) != "result_no_result" {
			t.Errorf("expected result_no_result, got %v", err)
		}
	})

	t.Run("list-op-wraps-resdata-into-entities", func(t *testing.T) {
		var made []any
		ctx := plCtx(client, utility, nil)
		ctx.Op = sdk.NewOperation(map[string]any{"entity": "x", "name": "list"})
		ctx.Entity = &plEntity{name: "x", made: &made}
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Result = sdk.NewResult(map[string]any{
			"resdata": []any{map[string]any{"a": 1}, map[string]any{"a": 2}},
		})
		result, err := utility.MakeResult(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		resdata, _ := result.Resdata.([]any)
		if len(resdata) != 2 {
			t.Errorf("expected 2 wrapped entities, got %v", result.Resdata)
		}
		if len(made) != 2 {
			t.Errorf("expected 2 Data() calls, got %d", len(made))
		}
	})

	t.Run("empty-list-yields-empty-resdata", func(t *testing.T) {
		var made []any
		ctx := plCtx(client, utility, nil)
		ctx.Op = sdk.NewOperation(map[string]any{"entity": "x", "name": "list"})
		ctx.Entity = &plEntity{name: "x", made: &made}
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		ctx.Result = sdk.NewResult(map[string]any{"resdata": []any{}})
		result, err := utility.MakeResult(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		resdata, ok := result.Resdata.([]any)
		if !ok || len(resdata) != 0 {
			t.Errorf("expected empty resdata slice, got %v", result.Resdata)
		}
	})
}

func TestPipelineMakeRequest(t *testing.T) {
	client, _ := plClient(t, nil)

	// A utility view whose fetcher is overridden.
	utilWith := func(fetcher sdk.FetcherFunc) *sdk.Utility {
		u := client.GetUtility()
		u.Fetcher = fetcher
		return u
	}

	reqSpec := func() *sdk.Spec {
		return sdk.NewSpec(map[string]any{
			"base":    "http://h",
			"path":    "a",
			"method":  "GET",
			"headers": map[string]any{},
			"step":    "s",
		})
	}

	t.Run("guards-missing-spec", func(t *testing.T) {
		utility := utilWith(func(_ *sdk.Context, _ string, _ map[string]any) (any, error) {
			return fhResponse(200, nil, nil), nil
		})
		ctx := plCtx(client, utility, nil)
		ctx.Spec = nil
		if _, err := utility.MakeRequest(ctx); fhErrCode(err) != "request_no_spec" {
			t.Errorf("expected request_no_spec, got %v", err)
		}
	})

	t.Run("transport-error-carried-on-response", func(t *testing.T) {
		utility := utilWith(func(ctx *sdk.Context, _ string, _ map[string]any) (any, error) {
			return nil, ctx.MakeError("boom", "boom")
		})
		ctx := plCtx(client, utility, nil)
		ctx.Spec = reqSpec()
		resp, err := utility.MakeRequest(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.Err == nil || fhErrCode(resp.Err) != "boom" {
			t.Errorf("expected transport error carried, got %v", resp.Err)
		}
	})

	t.Run("nil-transport-result-becomes-response-error", func(t *testing.T) {
		utility := utilWith(func(_ *sdk.Context, _ string, _ map[string]any) (any, error) {
			return nil, nil
		})
		ctx := plCtx(client, utility, nil)
		ctx.Spec = reqSpec()
		resp, err := utility.MakeRequest(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.Err == nil {
			t.Error("expected response error for nil transport result")
		}
	})

	t.Run("normal-transport-response-wrapped", func(t *testing.T) {
		utility := utilWith(func(_ *sdk.Context, _ string, _ map[string]any) (any, error) {
			return fhResponse(200, map[string]any{"a": 1}, nil), nil
		})
		ctx := plCtx(client, utility, nil)
		ctx.Spec = reqSpec()
		resp, err := utility.MakeRequest(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.Status != 200 {
			t.Errorf("expected 200, got %d", resp.Status)
		}
	})

	t.Run("records-fetchdef-to-ctrl-explain", func(t *testing.T) {
		utility := utilWith(func(_ *sdk.Context, _ string, _ map[string]any) (any, error) {
			return fhResponse(200, nil, nil), nil
		})
		ctx := plCtx(client, utility, map[string]any{"explain": map[string]any{}})
		ctx.Spec = reqSpec()
		if _, err := utility.MakeRequest(ctx); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ctx.Ctrl.Explain["fetchdef"] == nil {
			t.Error("expected explain.fetchdef recorded")
		}
	})
}

func TestPipelineDoneMakeError(t *testing.T) {
	client, utility := plClient(t, nil)

	t.Run("done-returns-resdata-on-success", func(t *testing.T) {
		ctx := plCtx(client, utility, nil)
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":      true,
			"resdata": map[string]any{"id": "i1"},
		})
		out, err := utility.Done(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		om, _ := out.(map[string]any)
		if om == nil || om["id"] != "i1" {
			t.Errorf("expected resdata, got %v", out)
		}
	})

	t.Run("done-errors-when-not-ok", func(t *testing.T) {
		ctx := plCtx(client, utility, nil)
		ctx.Result = sdk.NewResult(map[string]any{"ok": false})
		if _, err := utility.Done(ctx); err == nil {
			t.Error("expected an error when result not ok")
		}
	})

	t.Run("makeError-returns-resdata-when-throw-false", func(t *testing.T) {
		ctx := plCtx(client, utility, nil)
		throw := false
		ctx.Ctrl.Throw = &throw
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":      false,
			"resdata": "fallback",
		})
		out, err := utility.MakeError(ctx, ctx.MakeError("test_code", "test message"))
		if err != nil {
			t.Fatalf("expected no error with throw=false, got %v", err)
		}
		if out != "fallback" {
			t.Errorf("expected fallback resdata, got %v", out)
		}
	})

	t.Run("makeError-records-to-ctrl-explain", func(t *testing.T) {
		ctx := plCtx(client, utility, map[string]any{"explain": map[string]any{}})
		throw := false
		ctx.Ctrl.Throw = &throw
		ctx.Result = sdk.NewResult(map[string]any{"ok": false})
		if _, err := utility.MakeError(ctx, ctx.MakeError("x", "x")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ctx.Ctrl.Explain["err"] == nil {
			t.Error("expected explain.err recorded")
		}
	})
}

func TestPipelineFeatureAdd(t *testing.T) {
	t.Run("appends-by-default", func(t *testing.T) {
		client, utility := plClient(t, nil)
		ctx := plCtx(client, utility, nil)
		start := len(client.Features)
		f := sdk.NewBaseFeature()
		utility.FeatureAdd(ctx, f)
		if len(client.Features) != start+1 {
			t.Fatalf("expected %d features, got %d", start+1, len(client.Features))
		}
		if client.Features[len(client.Features)-1] != sdk.Feature(f) {
			t.Error("expected the feature appended last")
		}
	})

	t.Run("ordering-before-after-replace", func(t *testing.T) {
		named := func(name string) *sdk.BaseFeature {
			f := sdk.NewBaseFeature()
			f.Name = name
			return f
		}

		client, utility := plClient(t, nil)
		ctx := plCtx(client, utility, nil)
		client.Features = nil

		names := func() string {
			out := ""
			for i, ef := range client.Features {
				if i > 0 {
					out += ","
				}
				out += ef.GetName()
			}
			return out
		}
		utility.FeatureAdd(ctx, named("a"))
		utility.FeatureAdd(ctx, named("b"))
		if got := names(); got != "a,b" {
			t.Fatalf("setup: expected a,b got %s", got)
		}

		before := named("z1")
		before.AddOpts = map[string]any{"__before__": "b"}
		utility.FeatureAdd(ctx, before)
		if got := names(); got != "a,z1,b" {
			t.Fatalf("__before__: expected a,z1,b got %s", got)
		}

		after := named("z2")
		after.AddOpts = map[string]any{"__after__": "a"}
		utility.FeatureAdd(ctx, after)
		if got := names(); got != "a,z2,z1,b" {
			t.Fatalf("__after__: expected a,z2,z1,b got %s", got)
		}

		repl := named("z3")
		repl.AddOpts = map[string]any{"__replace__": "z1"}
		utility.FeatureAdd(ctx, repl)
		if got := names(); got != "a,z2,z3,b" {
			t.Fatalf("__replace__: expected a,z2,z3,b got %s", got)
		}

		// An ordering option naming no existing feature falls back to append.
		miss := named("z4")
		miss.AddOpts = map[string]any{"__before__": "missing"}
		utility.FeatureAdd(ctx, miss)
		if got := names(); got != "a,z2,z3,b,z4" {
			t.Fatalf("fallback append: expected a,z2,z3,b,z4 got %s", got)
		}
	})
}

func TestPipelineFeatureOrder(t *testing.T) {
	resolve := func(feature any) string {
		client, utility := plClient(t, nil)
		ctx := utility.MakeContext(map[string]any{
			"client":  client,
			"utility": utility,
		}, client.GetRootCtx())
		ctx.Options = map[string]any{"feature": feature}
		ctx.Config = map[string]any{"options": map[string]any{}}
		opts := utility.MakeOptions(ctx)
		derived, _ := opts["__derived__"].(map[string]any)
		fo, _ := derived["featureorder"].([]any)
		out := ""
		for i, n := range fo {
			if i > 0 {
				out += ","
			}
			s, _ := n.(string)
			out += s
		}
		return out
	}

	t.Run("map-form-is-test-first", func(t *testing.T) {
		got := resolve(map[string]any{
			"metrics": map[string]any{"active": true},
			"test":    map[string]any{"active": true},
		})
		if got != "test,metrics" {
			t.Fatalf("expected test,metrics got %s", got)
		}
	})

	t.Run("array-form-preserves-order", func(t *testing.T) {
		got := resolve([]any{
			map[string]any{"name": "metrics", "active": true},
			map[string]any{"name": "test", "active": true},
		})
		if got != "metrics,test" {
			t.Fatalf("expected metrics,test got %s", got)
		}
	})

	t.Run("map-form-no-test-deterministic", func(t *testing.T) {
		got := resolve(map[string]any{
			"retry": map[string]any{"active": true},
			"cache": map[string]any{"active": true},
		})
		if got != "cache,retry" {
			t.Fatalf("expected cache,retry got %s", got)
		}
	})
}

// plAuthCookiePair matches a cookie credential as PrepareAuth writes it:
// `<scheme>=K` for the probe key, with no scheme prefix and nothing else in
// the bag.
var plAuthCookiePair = regexp.MustCompile(`^[^=;]+=K$`)

// plAuthCred is where this SDK's PrepareAuth actually puts the credential.
// The name is the API's own scheme name, not always "authorization", so the
// cases below read it from a probe run instead of asserting a name. Pair is
// the `<scheme>=` lead-in of a COOKIE credential, which rides the header bag
// under the key "cookie" instead of taking a header of its own.
type plAuthCred struct {
	where string
	name  string
	value any
	pair  string
}

// plAuthBag picks the container by placement. A cookie credential rides the
// header bag, because a cookie IS a header.
func plAuthBag(spec *sdk.Spec, where string) map[string]any {
	if "query" == where {
		return spec.Query
	}
	return spec.Headers
}

// plAuth is the options auth block every case passes. `basic: false` is
// explicit: an HTTP Basic API's generated config carries `auth.basic: true`,
// and a client that merges it in takes a branch needing a secret as well.
// With none supplied that branch writes nothing, which the probe would then
// read as a public API.
func plAuth(prefix string) map[string]any {
	return map[string]any{"prefix": prefix, "basic": false}
}

// plAuthCredential runs PrepareAuth once with both containers present and
// reports which one it wrote to, and under what name. Nil means this SDK
// places no credential at all - a public API - which is a legitimate shape.
func plAuthProbe(t *testing.T, sdkopts map[string]any) *plAuthCred {
	t.Helper()
	client, utility := plClient(t, sdkopts)
	ctx := plCtx(client, utility, nil)
	ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
	if _, err := utility.PrepareAuth(ctx); err != nil {
		return nil
	}
	for _, where := range []string{"headers", "query"} {
		for name, value := range plAuthBag(ctx.Spec, where) {
			pair := ""
			text, is := value.(string)
			if "headers" == where && "cookie" == name && is &&
				plAuthCookiePair.MatchString(text) {
				pair = text[:len(text)-1]
			}
			return &plAuthCred{where: where, name: name, value: value, pair: pair}
		}
	}
	return nil
}

func plAuthCredential(t *testing.T) *plAuthCred {
	t.Helper()
	return plAuthProbe(t, map[string]any{"apikey": "K", "auth": plAuth("Bearer")})
}

// plAuthAnyCredential is every credential this SDK could possibly place: both
// credentials and Basic switched on, so whichever branch the API has,
// something lands unless the API is public.
func plAuthAnyCredential(t *testing.T) *plAuthCred {
	t.Helper()
	return plAuthProbe(t, map[string]any{
		"apikey": "K",
		"secret": "S",
		"auth":   map[string]any{"prefix": "Bearer", "basic": true},
	})
}

func TestPipelinePrepareAuth(t *testing.T) {

	cred := plAuthCredential(t)

	// placed runs PrepareAuth over a fresh spec, seeding the credential slot
	// first when seed is non-nil, and reports what is left there.
	placed := func(t *testing.T, sdkopts map[string]any, seed any) (any, bool) {
		t.Helper()
		client, utility := plClient(t, sdkopts)
		ctx := plCtx(client, utility, nil)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "s"})
		if cred != nil && seed != nil {
			plAuthBag(ctx.Spec, cred.where)[cred.name] = seed
		}
		if _, err := utility.PrepareAuth(ctx); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cred == nil {
			return nil, false
		}
		value, has := plAuthBag(ctx.Spec, cred.where)[cred.name]
		return value, has
	}

	t.Run("guards-missing-spec", func(t *testing.T) {
		client, utility := plClient(t, map[string]any{"apikey": "K"})
		ctx := plCtx(client, utility, nil)
		ctx.Spec = nil
		if _, err := utility.PrepareAuth(ctx); fhErrCode(err) != "auth_no_spec" {
			t.Errorf("expected auth_no_spec, got %v", err)
		}
	})

	// Without this the cases below cannot fail for an SDK whose credential the
	// probe misses: every one of them takes the public-API path instead.
	t.Run("probe-finds-the-credential-this-sdk-places", func(t *testing.T) {
		if (cred == nil) != (plAuthAnyCredential(t) == nil) {
			t.Error("the probe missed a credential this SDK places, so every " +
				"case below takes the public-API path")
		}
	})

	t.Run("apikey-placed-where-this-api-puts-it", func(t *testing.T) {
		if cred == nil {
			// A public API places nothing, and that is the whole assertion.
			if _, has := placed(t, map[string]any{
				"apikey": "K",
				"auth":   plAuth("Bearer"),
			}, nil); has {
				t.Errorf("expected no credential placed at all")
			}
			return
		}
		if cred.where != "headers" && cred.where != "query" {
			t.Fatalf("unexpected credential container %q", cred.where)
		}
		if "" != cred.pair {
			// A cookie credential is a `<scheme>=<key>` pair, and the scheme
			// name leaves no room for the option's prefix.
			text, _ := cred.value.(string)
			if !plAuthCookiePair.MatchString(text) {
				t.Errorf("expected a cookie pair, got %v", cred.value)
			}
			return
		}
		// A header credential is prefix-joined; a query credential is the raw
		// key, because a query parameter has nowhere to put a scheme name.
		want := "Bearer K"
		if "query" == cred.where {
			want = "K"
		}
		if cred.value != want {
			t.Errorf("expected %q in %s[%q], got %v",
				want, cred.where, cred.name, cred.value)
		}
	})

	t.Run("raw-apikey-empty-prefix-as-is", func(t *testing.T) {
		value, has := placed(t, map[string]any{
			"apikey": "K",
			"auth":   plAuth(""),
		}, nil)
		if cred == nil {
			if has {
				t.Errorf("expected no credential placed at all")
			}
			return
		}
		if value != cred.pair+"K" {
			t.Errorf("expected %q, got %v", cred.pair+"K", value)
		}
	})

	t.Run("empty-apikey-drops-credential", func(t *testing.T) {
		if _, has := placed(t, map[string]any{
			"apikey": "",
			"auth":   plAuth("Bearer"),
		}, "stale"); has {
			t.Errorf("expected the credential dropped")
		}
	})

	t.Run("missing-apikey-drops-credential", func(t *testing.T) {
		sdkopts := map[string]any{"auth": plAuth("Bearer")}
		client, _ := plClient(t, sdkopts)
		options := client.OptionsMap()
		if apikey, _ := options["apikey"].(string); apikey != "" {
			t.Skip("SDK options carry a configured apikey; case not reproducible here")
		}
		if _, has := placed(t, sdkopts, "stale"); has {
			t.Errorf("expected the credential dropped")
		}
	})

	t.Run("public-api-no-auth-block-drops-credential", func(t *testing.T) {
		sdkopts := map[string]any{"apikey": "K"}
		client, _ := plClient(t, sdkopts)
		if client.OptionsMap()["auth"] != nil {
			// Option validation supplies an auth shape for this SDK, so a
			// truly auth-less client cannot be constructed here (the ts test
			// fakes the client object; Go's prepareAuth reads the concrete
			// client options).
			t.Skip("options always carry an auth block in this SDK")
		}
		if _, has := placed(t, sdkopts, "stale"); has {
			t.Errorf("expected the credential dropped")
		}
	})
}

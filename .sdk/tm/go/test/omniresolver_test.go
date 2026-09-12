// The corpus test runner: vendored @voxgig/omni driven through its NATIVE
// API (`omni.MakeRunner(specref, provider)`), presented to the corpus tests
// in the struct-runner shape they already use (`RunPack.Spec`,
// `RunPack.RunSet`, `RunPack.RunSetFlags`, `RunPack.Client`). No compat
// shim is vendored: the adapter below IS the whole bridge, per language,
// per the vendor-tag rollout (docs/design/vendor-tag-rollout.md,
// Decision 4). It supersedes the engine halves of the retired
// runner_test.go and struct_runner_test.go (support lives on in
// testsupport_test.go).
//
// Go-specific decisions, each load-bearing:
//
// 1. REFLECTION PROVIDER. The omni provider hooks reach the client by
//    reflection over the names the clients already expose (Utility() /
//    GetUtility(), Struct(), Contextify(), Tester()), so ONE resolver
//    serves both the generated SDK and the struct-corpus client in
//    struct_utility_test.go. Ported from upstream's go compat shim
//    (omni go/compat/struct), which this resolver replaces.
//
// 2. CONTEXTS STAY MAPS ACROSS THE RUNNER. omni sets `entry.ctx` to the
//    contextified args[0] and `match: {ctx: ...}` assertions read THROUGH
//    it with omni's own GetPath, which walks JSON maps only. A typed
//    *sdk.Context there would make every ctx assertion read "absent". So
//    Contextify returns the MAP; a corpus subject builds the typed context
//    with omniCtx(args[0], ...) at the call site, runs the utility, and
//    writes the observable ctx state back into the same map with
//    omniSyncCtx - which is what makes the live SDK reachable through
//    ctx.Client for the generated utilities (the ts resolver gets both for
//    free from prototype delegation; maps-plus-sync is the go idiom for
//    the same contract).
//
// 3. ZERO-ARGUMENT ENTRIES (novalargs). The corpus carries entries with no
//    `in`, `args` or `ctx`, meaning "call the subject with NO argument".
//    omni's native rule passes [clone(entry.in)] - one null. The upstream
//    go compat shim corrected this by handing such entries the struct
//    port's own no-value sentinel (NOVAL); that correction is ported here
//    (novalargs/novalsubject/NOVALMARK), not dropped.
//
// 4. THE VENDORED GO PORT LACKS THE omni#54 RUNNER FIXES the TypeScript
//    port has at this tag (omni#57 tracks porting them): JsonStr has no
//    cycle guard, and Match clones its base. Both only bite on CYCLIC
//    values, and go's Clone/FixJson pass non-JSON values (a typed context,
//    a client) through by reference without walking them - so decision 2
//    above (JSON-only maps in entries, typed state kept out of them) is
//    also what keeps every value the runner clones or stringifies acyclic.
//    The errify half (non-Error throwables) cannot arise in go: subjects
//    return `error` values, and the Errify hook below keeps the SDK
//    error's code for `match: {err: {code: ...}}` assertions.

package sdktest

import (
	"fmt"
	"reflect"
	"strings"
	"sync"

	sdk "GOMODULE"
	omni "GOMODULE/test/omni"

	vs "github.com/voxgig/struct"
)

// The shared corpus, compiled by the project build. Relative to this
// package directory, which is where `go test` runs.
const TEST_JSON_FILE = "../../.sdk/test/test.json"

// The sentinels, under the names the corpus tests already use.
var (
	NULLMARK   = omni.NULLMARK
	UNDEFMARK  = omni.UNDEFMARK
	EXISTSMARK = omni.EXISTSMARK
)

// TestingT is the part of *testing.T the runner API uses. An interface, so
// the runner-must-fail smoke test can hand in a recorder and observe the
// failure instead of failing itself.
type TestingT interface {
	Helper()
	Error(args ...any)
}

// Subject is the function under test, in omni's native form.
type Subject = omni.Subject

// RunSet runs one set of test entries, reporting failures to the test.
type RunSet func(t TestingT, testspec any, testsubject any)

// RunSetFlags runs one set of test entries with flags.
type RunSetFlags func(t TestingT, testspec any, flags map[string]bool, testsubject any)

// RunPack is what the runner returns for one named spec section - the
// struct-runner shape the corpus call sites consume.
type RunPack struct {
	Spec        map[string]any
	RunSet      RunSet
	RunSetFlags RunSetFlags
	Subject     Subject
	Client      any
}

// MakeRunner is the struct runner's makeRunner(testfile, client)
// signature, backed by vendored omni. `testfile` is a spec path or an
// already-parsed spec value (omni's own capability), which keeps smoke
// tests free of fixture files.
func MakeRunner(testfile any, client any) func(name string, store any) (*RunPack, error) {
	provider := omniProvider(client)
	sentinel := any(vs.NOVAL)
	runner, mkerr := omni.MakeRunner(testfile, provider)

	return func(name string, store any) (*RunPack, error) {
		if nil != mkerr {
			return nil, mkerr
		}

		pack, err := runner(name, store)
		if nil != err {
			return nil, err
		}

		spec, _ := pack.Spec.(map[string]any)

		runsetflags := func(t TestingT, testspec any, flags map[string]bool, testsubject any) {
			t.Helper()

			usespec, patched := novalargs(fixnums(testspec), sentinel)

			subject := pack.Subject
			if nil != testsubject {
				subject = subjectify(testsubject)
			}
			subject = novalsubject(subject, sentinel, patched)

			if err := pack.RunSetFlags(usespec, omniflags(flags), subject); nil != err {
				t.Error(err.Error())
			}
		}

		runset := func(t TestingT, testspec any, testsubject any) {
			t.Helper()
			runsetflags(t, testspec, nil, testsubject)
		}

		return &RunPack{
			Spec:        spec,
			RunSet:      runset,
			RunSetFlags: runsetflags,
			Subject:     pack.Subject,
			Client:      client,
		}, nil
	}
}

// The runner's flags are booleans; omni's carry any value.
func omniflags(flags map[string]bool) omni.Flags {
	out := omni.Flags{}
	for name, flag := range flags {
		out[name] = flag
	}
	return out
}

// providerclients maps each omni provider back to the live client it
// wraps, and defproviders marks the ones a spec's DEF.client built - the
// only ones omniCtx lets override a call site's explicit client (the base
// provider rides on EVERY ctx entry, and letting it win would defeat the
// sections that deliberately construct a differently-optioned client).
// Guarded: corpus subtests may run concurrently.
var (
	providerclientsmu sync.Mutex
	providerclients   = map[*omni.Provider]any{}
	defproviders      = map[*omni.Provider]bool{}
)

func registerprovider(provider *omni.Provider, client any) {
	providerclientsmu.Lock()
	defer providerclientsmu.Unlock()
	providerclients[provider] = client
}

func markdefprovider(provider *omni.Provider) {
	providerclientsmu.Lock()
	defer providerclientsmu.Unlock()
	defproviders[provider] = true
}

func defproviderclient(provider *omni.Provider) any {
	providerclientsmu.Lock()
	defer providerclientsmu.Unlock()
	if !defproviders[provider] {
		return nil
	}
	return providerclients[provider]
}

// omniProvider wraps a client as an omni provider. The live client is
// registered so that map ctx entries can be resolved back to it.
func omniProvider(client any) *omni.Provider {
	provider := &omni.Provider{
		// A subject resolves from the utility: a method, a utility func
		// field (the generated SDK's shape), or a func field on the
		// utility's Struct() container (the struct corpus client's shape).
		Subject: func(name string) omni.Subject {
			utility := utilityof(client)

			if method := findmethod(utility, name); method.IsValid() {
				return subjectify(method.Interface())
			}

			if field := findfield(utility, name); field.IsValid() &&
				reflect.Func == field.Kind() && !field.IsNil() {
				return subjectify(field.Interface())
			}

			field := findfield(structutilof(utility), name)
			if field.IsValid() && reflect.Func == field.Kind() && !field.IsNil() {
				return subjectify(field.Interface())
			}

			return nil
		},

		// A DEF.client entry becomes another live client instance, wrapped
		// the same way.
		Client: func(options any) (*omni.Provider, error) {
			tester := findmethod(reflect.ValueOf(client), "tester")
			if !tester.IsValid() {
				return nil, fmt.Errorf("omniresolver: client has no Tester method")
			}

			opts, is := options.(map[string]any)
			if !is {
				opts = map[string]any{}
			}

			results := tester.Call([]reflect.Value{reflect.ValueOf(opts)})
			if 2 != len(results) {
				return nil, fmt.Errorf("omniresolver: Tester must return (client, error)")
			}
			if err, is := results[1].Interface().(error); is && nil != err {
				return nil, err
			}

			sub := omniProvider(results[0].Interface())
			markdefprovider(sub)
			return sub, nil
		},

		// The ctx STAYS a map (see decision 2 above). The client's own
		// contextify hook runs when it has one (the struct corpus client
		// does); the utility rides along for subjects that read it.
		Contextify: func(val any) any {
			utility := utilityof(client)

			ctx := val
			if hook := findmethod(utility, "contextify"); hook.IsValid() {
				if ctxmap, is := val.(map[string]any); is {
					results := hook.Call([]reflect.Value{reflect.ValueOf(ctxmap)})
					if 1 == len(results) {
						ctx = results[0].Interface()
					}
				}
			}

			if ctxmap, is := ctx.(map[string]any); is && utility.IsValid() {
				ctxmap["utility"] = utility.Interface()
			}

			return ctx
		},

		// Client options may reference the runner store.
		Inject: func(options any, store any) any {
			vs.Inject(options, store)
			return options
		},

		// Keep the SDK error's code beside its message, so a corpus
		// `match: {err: {code: ...}}` can assert on it - the go analogue
		// of the omni#54 errify fix.
		Errify: func(err any) any {
			if sdkerr, is := err.(*sdk.PlaystationStoreApi2Error); is {
				out := map[string]any{
					"name":    "PlaystationStoreApi2Error",
					"message": sdkerr.Error(),
				}
				if "" != sdkerr.Code {
					out["code"] = sdkerr.Code
				}
				return out
			}
			return omni.Errify(err)
		},
	}

	registerprovider(provider, client)

	return provider
}

// utilityof reaches the client's utility: Utility() on the struct corpus
// client, GetUtility() on the generated SDK. Only a ZERO-ARGUMENT method
// counts - a generated SDK with an entity named `utility` has an entity
// ACCESSOR of the same name that takes options, and calling that here
// would panic (the fixture model ships reserved-name entities precisely to
// catch this class of collision).
func utilityof(client any) reflect.Value {
	method := findnullarymethod(reflect.ValueOf(client), "utility")
	if !method.IsValid() {
		method = findnullarymethod(reflect.ValueOf(client), "getutility")
	}
	if !method.IsValid() {
		return reflect.Value{}
	}

	results := method.Call(nil)
	if 1 != len(results) {
		return reflect.Value{}
	}

	return reflect.ValueOf(results[0].Interface())
}

// findnullarymethod is findmethod restricted to methods that take no
// arguments and return exactly one value.
func findnullarymethod(val reflect.Value, name string) reflect.Value {
	if !val.IsValid() || "" == name {
		return reflect.Value{}
	}

	valtype := val.Type()
	for index := 0; index < valtype.NumMethod(); index++ {
		if !strings.EqualFold(valtype.Method(index).Name, name) {
			continue
		}
		method := val.Method(index)
		if 0 == method.Type().NumIn() && 1 == method.Type().NumOut() {
			return method
		}
	}

	return reflect.Value{}
}

func structutilof(utility reflect.Value) reflect.Value {
	method := findnullarymethod(utility, "struct")
	if !method.IsValid() {
		return reflect.Value{}
	}

	results := method.Call(nil)
	if 1 != len(results) {
		return reflect.Value{}
	}

	return reflect.ValueOf(results[0].Interface())
}

// Spec names are lower case; Go names are exported, and some are
// multi-word (`getpath` is `GetPath`), so match without case.
func findmethod(val reflect.Value, name string) reflect.Value {
	if !val.IsValid() || "" == name {
		return reflect.Value{}
	}

	valtype := val.Type()
	for index := 0; index < valtype.NumMethod(); index++ {
		if strings.EqualFold(valtype.Method(index).Name, name) {
			return val.Method(index)
		}
	}

	return reflect.Value{}
}

func findfield(val reflect.Value, name string) reflect.Value {
	if !val.IsValid() || "" == name {
		return reflect.Value{}
	}

	if reflect.Pointer == val.Kind() {
		if val.IsNil() {
			return reflect.Value{}
		}
		val = val.Elem()
	}

	if reflect.Struct != val.Kind() {
		return reflect.Value{}
	}

	valtype := val.Type()
	for index := 0; index < valtype.NumField(); index++ {
		if strings.EqualFold(valtype.Field(index).Name, name) {
			return val.Field(index)
		}
	}

	return reflect.Value{}
}

// novalargs rewrites entries with no `in`, `args` or `ctx` to carry a
// MARKER the subject wrapper swaps for the port's real no-value sentinel
// at the call boundary. The marker (a string) survives omni's fixjson
// normalisation; the sentinel (a struct pointer) would not. Ported from
// the upstream go compat shim - see decision 3 in the header.
func novalargs(testspec any, sentinel any) (any, bool) {
	if nil == sentinel {
		return testspec, false
	}

	spec, is := testspec.(map[string]any)
	if !is {
		return testspec, false
	}

	set, is := spec["set"].([]any)
	if !is {
		return testspec, false
	}

	found := false
	for _, entry := range set {
		if noargs(entry) {
			found = true
			break
		}
	}
	if !found {
		return testspec, false
	}

	patched := make([]any, len(set))
	for index, entry := range set {
		if noargs(entry) {
			copied := map[string]any{}
			for key, val := range entry.(map[string]any) {
				copied[key] = val
			}
			copied["args"] = []any{NOVALMARK}
			entry = copied
		}
		patched[index] = entry
	}

	out := map[string]any{}
	for key, val := range spec {
		out[key] = val
	}
	out["set"] = patched

	return out, true
}

// NOVALMARK stands in for the port's no-value between novalargs and
// novalsubject. Deliberately not one of omni's own sentinels: those are
// meaningful to the runner, and this one must pass through it inert.
const NOVALMARK = "__OMNIRESOLVER_NOVAL__"

// novalsubject swaps the marker back for the real sentinel at the point of
// call. Only installed for a spec novalargs actually rewrote, so a corpus
// value that legitimately holds the marker string is never touched.
func novalsubject(subject Subject, sentinel any, patched bool) Subject {
	if nil == sentinel || nil == subject || !patched {
		return subject
	}

	return func(args ...any) (any, error) {
		for index, arg := range args {
			if mark, is := arg.(string); is && NOVALMARK == mark {
				args[index] = sentinel
			}
		}
		return subject(args...)
	}
}

func noargs(entry any) bool {
	fields, is := entry.(map[string]any)
	if !is {
		return false
	}

	for _, key := range []string{"in", "args", "ctx"} {
		if _, has := fields[key]; has {
			return false
		}
	}

	return true
}

// fixnums: an integral JSON number becomes a Go `int`, on both the spec
// and the result side. The struct port's API is written in `int`
// (`Typename(t int)`, `Flatten(list, depths ...int)`), and omni's go
// runner keeps JSON numbers as float64 - handing a subject a type its
// signature rejects. omni's DeepEqual compares numbers by value, so the
// normalisation is invisible to assertions.
func fixnums(val any) any {
	switch value := val.(type) {
	case float64:
		if value == float64(int(value)) {
			return int(value)
		}
		return val

	case map[string]any:
		out := make(map[string]any, len(value))
		for key, entry := range value {
			out[key] = fixnums(entry)
		}
		return out

	case []any:
		out := make([]any, len(value))
		for index, entry := range value {
			out[index] = fixnums(entry)
		}
		return out

	default:
		return val
	}
}

// subjectify adapts any Go function to omni's calling convention, so a
// corpus test can pass the library function itself as the subject
// (voxgigstruct.IsNode is func(any) bool - nothing assigns to
// omni.Subject without this). Missing arguments become the parameter's
// zero value, and a (value, error) pair becomes omni's result.
func subjectify(fn any) Subject {
	if subject, is := fn.(Subject); is {
		return subject
	}

	fnval := reflect.ValueOf(fn)
	if !fnval.IsValid() || reflect.Func != fnval.Kind() {
		panic("omniresolver: subject is not a function")
	}

	fntype := fnval.Type()

	return func(args ...any) (any, error) {
		fixed := fntype.NumIn()
		if fntype.IsVariadic() {
			fixed--
		}

		if len(args) < fixed {
			extended := make([]any, fixed)
			copy(extended, args)
			args = extended
		}

		in := make([]reflect.Value, 0, len(args))

		for index := 0; index < fixed; index++ {
			val, err := callarg(args[index], fntype.In(index), index)
			if nil != err {
				return nil, err
			}
			in = append(in, val)
		}

		if fntype.IsVariadic() {
			elemtype := fntype.In(fntype.NumIn() - 1).Elem()
			for index := fixed; index < len(args); index++ {
				val, err := callarg(args[index], elemtype, index)
				if nil != err {
					return nil, err
				}
				in = append(in, val)
			}
		}

		out := fnval.Call(in)

		switch len(out) {
		case 0:
			return nil, nil
		case 1:
			return fixnums(out[0].Interface()), nil
		case 2:
			err, _ := out[1].Interface().(error)
			return fixnums(out[0].Interface()), err
		default:
			return nil, fmt.Errorf("omniresolver: subject returns too many values (%d)", len(out))
		}
	}
}

func callarg(arg any, paramtype reflect.Type, index int) (reflect.Value, error) {
	if nil == arg {
		return reflect.Zero(paramtype), nil
	}

	val := reflect.ValueOf(arg)
	if !val.Type().AssignableTo(paramtype) {
		return reflect.Value{}, fmt.Errorf(
			"omniresolver: argument %d type %T not assignable to parameter type %s",
			index, arg, paramtype)
	}

	return val, nil
}

// omniCtx builds the typed *sdk.Context a generated utility takes from the
// ctx MAP omni handed the subject (args[0]). The map's `client` entry - an
// omni provider when a DEF entry selected one - resolves back to the live
// SDK it wraps; otherwise the given client is used. The engine half of the
// retired runner_test.go did this as makeCtxFromMap.
func omniCtx(arg any, client *sdk.PlaystationStoreApi2SDK, utility *sdk.Utility) *sdk.Context {
	ctxmap, _ := arg.(map[string]any)
	if ctxmap == nil {
		ctxmap = map[string]any{}
	}

	// Only a DEF-built client overrides the caller's: the base provider is
	// on every ctx entry, and a call site that constructed a special client
	// (a DEF.setup options set) must keep it - the same override the ts
	// subjects perform by assigning ctx.client after contextify.
	if provider, is := ctxmap["client"].(*omni.Provider); is {
		if live, is := defproviderclient(provider).(*sdk.PlaystationStoreApi2SDK); is {
			client = live
			utility = live.GetUtility()
		}
	}

	ctx := sdk.NewContext(ctxmap, nil)

	if client != nil {
		ctx.Client = client
		ctx.Utility = utility
	}
	if ctx.Options == nil && client != nil {
		ctx.Options = client.OptionsMap()
	}

	// Handle spec from JSON map (NewContext expects *Spec, but JSON gives map)
	if specMap, ok := ctxmap["spec"].(map[string]any); ok {
		ctx.Spec = sdk.NewSpec(specMap)
	}

	// Handle result from JSON map
	if resMap, ok := ctxmap["result"].(map[string]any); ok {
		ctx.Result = sdk.NewResult(resMap)
		if errMap, ok := resMap["err"].(map[string]any); ok {
			if msg, ok := errMap["message"].(string); ok {
				ctx.Result.Err = &sdk.PlaystationStoreApi2Error{Msg: msg}
			}
		}
	}

	// Handle response from JSON map
	if respMap, ok := ctxmap["response"].(map[string]any); ok {
		ctx.Response = sdk.NewResponse(respMap)
		if body := respMap["body"]; body != nil {
			bodyCopy := body
			ctx.Response.JsonFunc = func() any { return bodyCopy }
		}
		if headers, ok := respMap["headers"].(map[string]any); ok {
			lowerHeaders := map[string]any{}
			for k, v := range headers {
				lowerHeaders[strings.ToLower(k)] = v
			}
			ctx.Response.Headers = lowerHeaders
		}
	}

	return ctx
}

// omniSyncCtx writes the OBSERVABLE state of a typed context back into the
// ctx map the entry holds, which is where a `match: {ctx: ...}` assertion
// reads. The subject mutated the typed context; the map is what the runner
// can walk. (The retired engine did this per section, by hand, as "update
// entry ctx for match".)
func omniSyncCtx(arg any, ctx *sdk.Context) {
	ctxmap, _ := arg.(map[string]any)
	if ctxmap == nil || ctx == nil {
		return
	}

	if ctx.Spec != nil {
		spec := map[string]any{
			"base":    ctx.Spec.Base,
			"prefix":  ctx.Spec.Prefix,
			"suffix":  ctx.Spec.Suffix,
			"path":    ctx.Spec.Path,
			"method":  ctx.Spec.Method,
			"params":  ctx.Spec.Params,
			"query":   ctx.Spec.Query,
			"headers": ctx.Spec.Headers,
			"step":    ctx.Spec.Step,
			"alias":   ctx.Spec.Alias,
		}
		if ctx.Spec.Body != nil {
			spec["body"] = ctx.Spec.Body
		}
		if ctx.Spec.Url != "" {
			spec["url"] = ctx.Spec.Url
		}
		ctxmap["spec"] = spec
	}

	if ctx.Result != nil {
		res := map[string]any{
			"ok":         ctx.Result.Ok,
			"status":     ctx.Result.Status,
			"statusText": ctx.Result.StatusText,
			"headers":    ctx.Result.Headers,
		}
		if ctx.Result.Body != nil {
			res["body"] = ctx.Result.Body
		}
		if ctx.Result.Err != nil {
			res["err"] = map[string]any{
				"message": ctx.Result.Err.Error(),
			}
		}
		if ctx.Result.Resdata != nil {
			res["resdata"] = ctx.Result.Resdata
		}
		if ctx.Result.Resmatch != nil {
			res["resmatch"] = ctx.Result.Resmatch
		}
		ctxmap["result"] = res
	}

	if ctx.Response != nil {
		ctxmap["response"] = "exists"
	}
}

// omniErrArg turns a corpus argument shaped {"message": ..., "code": ...}
// into an SDK error value (the retired engine's errFromMap).
func omniErrArg(arg any) error {
	m, _ := arg.(map[string]any)
	if m == nil {
		return nil
	}
	msg, _ := m["message"].(string)
	if msg == "" {
		return nil
	}
	code, _ := m["code"].(string)
	return &sdk.PlaystationStoreApi2Error{Msg: msg, Code: code}
}

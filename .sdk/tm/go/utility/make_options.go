package utility

import (
	"regexp"
	"sort"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

// {name} placeholders in a templated server URL (OpenAPI server variables).
var serverVarRe = regexp.MustCompile(`\{[A-Za-z0-9_]+\}`)

func makeOptionsUtil(ctx *core.Context) map[string]any {
	options := ctx.Options
	if options == nil {
		options = map[string]any{}
	}

	// Merge custom utility overrides onto the utility object.
	// Read from original options before clone, since vs.Clone strips functions.
	//
	// A key naming a real utility member REPLACES it (overrideUtil); anything
	// else is attached as a custom extra. This mirrors ts, where the utility is
	// an open object and `setprop` does both at once.
	if customUtils := core.ToMapAny(options["utility"]); customUtils != nil {
		utility := ctx.Utility
		if utility != nil {
			for key, val := range customUtils {
				if !overrideUtil(utility, key, val) {
					utility.Custom[key] = val
				}
			}
		}
	}

	// `auth: nil` is the documented way to disable auth outright, and
	// prepareAuth honours it before it ever reads the apikey. But validate
	// treats a stored nil as "no value", so the optspec's `auth` default
	// fires and the suppression silently becomes "use default auth" —
	// transmitting a credential the caller explicitly asked not to send.
	//
	// Suppliedness cannot be recovered after validate, hence here. The
	// two-value form is required: options["auth"] reads nil both when the
	// key is ABSENT and when it is present and nil, and only the second is
	// a suppression. (ts gets this for free — `null === options.auth` is
	// false for an omitted key, since that reads undefined.)
	authval, authgiven := options["auth"]
	authsuppressed := authgiven && authval == nil

	opts := vs.Clone(options).(map[string]any)

	// Feature add-order (feature #2). options.feature may be given as an ordered
	// ARRAY of {name, active, ...opts} entries (the array position IS the order
	// in which features are added), or as a {name:{opts}} map. Normalize an
	// array to a map (so merge/validate/init are unchanged) and remember the
	// explicit order; a map defaults to test-first so the `test` mock transport
	// is installed as the base of the transport wrapper chain.
	var featureorder []any
	if farr, ok := opts["feature"].([]any); ok {
		fmap := map[string]any{}
		for _, entry := range farr {
			em := core.ToMapAny(entry)
			if em == nil {
				continue
			}
			name, _ := em["name"].(string)
			if name == "" {
				continue
			}
			fopts := map[string]any{}
			for k, v := range em {
				if k != "name" {
					fopts[k] = v
				}
			}
			fmap[name] = fopts
			featureorder = append(featureorder, name)
		}
		opts["feature"] = fmap
	}

	config := ctx.Config
	if config == nil {
		config = map[string]any{}
	}
	cfgopts := map[string]any{}
	if co, ok := config["options"]; ok && co != nil {
		if cm, ok := co.(map[string]any); ok {
			cfgopts = cm
		}
	}

	optspec := map[string]any{
		"apikey": "",
		"base":   "http://localhost:8000",
		"prefix": "",
		"suffix": "",
		"auth": map[string]any{
			"prefix": "",
		},
		"headers": map[string]any{
			"`$CHILD`": "`$STRING`",
		},
		"allow": map[string]any{
			"method": "GET,PUT,POST,PATCH,DELETE,OPTIONS",
			"op":     "create,update,load,list,remove,command,direct,graphql",
		},
		"entity": map[string]any{
			"`$CHILD`": map[string]any{
				"`$OPEN`": true,
				"active":  false,
				"alias":   map[string]any{},
			},
		},
		"feature": map[string]any{
			"`$CHILD`": map[string]any{
				"`$OPEN`": true,
				"active":  false,
			},
		},
		"utility": map[string]any{},
		// Feature INSTANCES supplied at construction (the station adopt
		// path): consumed by the constructor's featureAdd loop, so they
		// are class instances, not data - `$ANY` accepts them verbatim.
		// Without this entry the seam is dead: the constructor reads
		// options.extend, but validate rejected the key (mirrors
		// MakeOptionsUtility.ts).
		"extend": "`$ANY`",
		"system": map[string]any{},
		"test": map[string]any{
			"active": false,
			"entity": map[string]any{
				"`$OPEN`": true,
			},
		},
		"clean": map[string]any{
			"keys": "key,token,id",
		},
		// Server-variable values for a templated base URL (OpenAPI server
		// variables): {name} placeholders in "base" are substituted from this
		// map at construction. Spec defaults arrive via the generated config;
		// user values override them.
		"server": map[string]any{
			"`$CHILD`": "",
		},
	}

	// Preserve system.fetch before merge/validate.
	var sysFetch any
	if sf := vs.GetPath(opts, []any{"system", "fetch"}); sf != nil {
		sysFetch = sf
	}

	// Clone the config side before merging: `config` is a process-wide
	// singleton (see core.SharedConfig), and Merge would otherwise use its
	// nested maps as merge TARGETS — one instance's options (server, headers,
	// ...) would contaminate every instance constructed after it.
	merged := vs.Merge([]any{map[string]any{}, vs.Clone(cfgopts), opts})
	validated, _ := vs.Validate(merged, optspec)
	opts = validated.(map[string]any)

	// Restore the suppression the optspec default would otherwise erase.
	if authsuppressed {
		opts["auth"] = nil
	}

	// Resolve a templated base URL (e.g. https://{tenant_id}.hanko.io).
	// Every placeholder must resolve to a non-empty value: from
	// options["server"] (user), else the config default. A placeholder that
	// resolves to "" is a construction error in live mode — the URL cannot
	// work — but in test mode substitutes the deterministic value
	// "test-<name>" so offline tests need no configuration. The SDK
	// constructor has no error return, so a missing required variable
	// PANICS (construction-time misconfiguration, as regexp.MustCompile).
	if base, ok := opts["base"].(string); ok && strings.Contains(base, "{") {
		testmode := false
		if ta, ok := vs.GetPath(opts, []any{"test", "active"}).(bool); ok && ta {
			testmode = true
		}
		if fa, ok := vs.GetPath(opts, []any{"feature", "test", "active"}).(bool); ok && fa {
			testmode = true
		}
		server := core.ToMapAny(opts["server"])
		sdkname := "SDK"
		if mn, ok := vs.GetPath(config, []any{"main", "name"}).(string); ok && mn != "" {
			sdkname = mn
		}
		resolved := serverVarRe.ReplaceAllStringFunc(base, func(ph string) string {
			name := ph[1 : len(ph)-1]
			val, _ := server[name].(string)
			if val == "" {
				if testmode {
					return "test-" + name
				}
				panic(sdkname + ": the server variable '" + name + "' is required: " +
					"the API base URL is '" + base + "' — pass " +
					`options["server"].(map)["` + name + `"] in the SDK options`)
			}
			return val
		})
		opts["base"] = resolved
	}

	// Restore system.fetch.
	if sysFetch != nil {
		if sys, ok := opts["system"]; ok {
			if sm, ok := sys.(map[string]any); ok {
				sm["fetch"] = sysFetch
			}
		} else {
			opts["system"] = map[string]any{"fetch": sysFetch}
		}
	}

	// Derived clean config.
	cleanKeys := "key,token,id"
	if ck := vs.GetPath(opts, []any{"clean", "keys"}); ck != nil {
		if cks, ok := ck.(string); ok {
			cleanKeys = cks
		}
	}

	parts := strings.Split(cleanKeys, ",")
	var filtered []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			filtered = append(filtered, vs.EscRe(p))
		}
	}
	keyre := strings.Join(filtered, "|")

	// Resolve the feature add-order: an explicit array order (above) wins;
	// otherwise order the map test-first, then the remaining names sorted, so
	// the outcome is deterministic and `test` is always the base transport.
	if len(featureorder) == 0 {
		fmap := core.ToMapAny(opts["feature"])
		names := make([]string, 0, len(fmap))
		for k := range fmap {
			names = append(names, k)
		}
		sort.Strings(names)
		hasTest := false
		for _, n := range names {
			if n == "test" {
				hasTest = true
			}
		}
		ordered := make([]string, 0, len(names))
		if hasTest {
			ordered = append(ordered, "test")
			for _, n := range names {
				if n != "test" {
					ordered = append(ordered, n)
				}
			}
		} else {
			ordered = append(ordered, names...)
		}
		// Station special case, mirroring test's: its transport wrap must
		// sit immediately outside the base transport (inside retry/cache/
		// netsim), so map-form activation hoists it to just after test -
		// or first, when no test entry exists. Without this the sorted
		// default would init station last and wrap OUTSIDE the recording
		// features, turning its wire-truth events into fiction.
		si := -1
		for i, n := range ordered {
			if n == "station" {
				si = i
				break
			}
		}
		if si >= 0 {
			ordered = append(ordered[:si], ordered[si+1:]...)
			ti := 0
			for i, n := range ordered {
				if n == "test" {
					ti = i + 1
					break
				}
			}
			ordered = append(ordered[:ti],
				append([]string{"station"}, ordered[ti:]...)...)
		}
		for _, n := range ordered {
			featureorder = append(featureorder, n)
		}
	}

	derived := map[string]any{
		"clean": map[string]any{},
	}
	if keyre != "" {
		derived["clean"] = map[string]any{"keyre": keyre}
	}
	derived["featureorder"] = featureorder
	opts["__derived__"] = derived

	return opts
}

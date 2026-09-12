// VENDORED: @voxgig/omni sdk-20260908-1556-0 (go/omni.go)
// Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// Omni: the shared multi-language test runner.
//
// A test spec is plain JSON. The same spec file drives the same tests in
// every language that ships an omni port.
//
// Port of the canonical TypeScript implementation
// (typescript/src/Runner.ts). Behaviour must match, case for case.
//
// Go has no exceptions, so a failing check is returned as an error rather
// than thrown: `if err := runset(spec, subject); nil != err { t.Fatal(err) }`.

package omni

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"reflect"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
)

// Subject is the function under test. A spec entry's arguments arrive as a
// list of JSON values.
type Subject func(args ...any) (any, error)

// Flags are the run-time options for a set of test entries.
type Flags map[string]any

// Provider hosts the system under test. Every hook is optional.
type Provider struct {
	// Subject resolves a test subject by name.
	Subject func(name string) Subject
	// Client builds a sub-provider from a DEF.client entry's options.
	Client func(options any) (*Provider, error)
	// Contextify wraps a map argument as a call context.
	Contextify func(val any) any
	// Inject resolves references in client options against the store.
	Inject func(options any, store any) any
	// Errify builds the `match.err` base from the raised error, REPLACING
	// the default Errify. A library whose errors carry a code can then
	// assert on it with `match: {err: {code: "x"}}` instead of
	// pattern-matching prose.
	//
	// `any`, not `map[string]any`, because the canonical is `(err) => Json`
	// and `match.err` compares a scalar or a list as readily as a map. The
	// built-in Errify happens to return a map; a hook is not held to that.
	Errify func(err any) any
}

// RunSet runs one set of test entries.
type RunSet func(testspec any, subject Subject) error

// RunSetFlags runs one set of test entries with flags.
type RunSetFlags func(testspec any, flags Flags, subject Subject) error

// RunPack is what a runner returns for one named spec section.
type RunPack struct {
	Spec        any
	RunSet      RunSet
	RunSetFlags RunSetFlags
	Subject     Subject
	Client      *Provider
}

// Set returns a named group of the resolved spec.
func (runpack *RunPack) Set(name string) any {
	if spec, is := runpack.Spec.(map[string]any); is {
		return spec[name]
	}
	return nil
}

// Runner resolves one named section of a spec.
type Runner func(name string, store any) (*RunPack, error)

// SPECVERSION is the newest spec format version this runner understands. A
// spec with no OMNI block is version 0: the original, lenient format,
// frozen forever. Version 1 turns on strict entry validation (see
// checkentry).
const SPECVERSION = 1

// CAPABILITIES are the capability strings this runner supports beyond the
// version baseline. A spec's OMNI.requires list is checked against this: an
// unknown capability refuses the spec loudly at load time, instead of a
// lagging port silently mis-running it. (Empty today; future format
// features mint a string here.)
var CAPABILITIES = []string{}

// ENTRYFIELDS is the complete set of fields an entry may carry. Under
// version 1 anything else is an error: an unrecognised key is almost
// always a typo'd assertion, and a typo'd assertion is a test that
// silently stopped testing.
var ENTRYFIELDS = []string{"in", "args", "ctx", "out", "err", "match", "client", "id", "doc"}

// OmniError is a test failure (or a malformed spec). Distinct from errors
// returned by the subject under test, which are candidates for an `err`
// expectation.
type OmniError struct {
	Message string
	Entry   any
}

func (omnierr *OmniError) Error() string {
	return omnierr.Message
}

// IsOmniError reports whether an error is a test failure.
func IsOmniError(err error) bool {
	_, is := err.(*OmniError)
	return is
}

// LoadSpec loads a spec: a path to a JSON file, or an already-parsed value.
func LoadSpec(specref any) (any, error) {
	if path, is := specref.(string); is {
		text, err := os.ReadFile(path)
		if nil != err {
			return nil, &OmniError{Message: "omni: cannot read spec: " + path}
		}
		var alltests any
		if err := json.Unmarshal(text, &alltests); nil != err {
			return nil, &OmniError{Message: "omni: cannot parse spec: " + path + ": " + err.Error()}
		}
		return alltests, nil
	}
	return specref, nil
}

// resolveversion reads the spec's format version from its optional
// top-level OMNI block, and refuses a spec this runner cannot faithfully
// run: a version newer than SPECVERSION, or a required capability not in
// CAPABILITIES.
func resolveversion(alltests any) (int, error) {
	specmap, is := alltests.(map[string]any)
	if !is {
		return 0, nil
	}

	// A present-but-null block is malformed, exactly as in canonical -
	// only a genuinely absent OMNI key means version 0.
	meta, has := specmap["OMNI"]
	if !has {
		return 0, nil
	}

	metamap, ismetamap := meta.(map[string]any)
	version, isnum := ToNum(metamap["version"])
	if !ismetamap || !isnum || version != math.Trunc(version) {
		return 0, &OmniError{Message: "omni: malformed OMNI version block"}
	}

	if version < 0 || SPECVERSION < version {
		return 0, &OmniError{Message: "omni: unsupported spec version: " + strconv.Itoa(int(version))}
	}

	if requires, has := metamap["requires"]; has {
		list, is := requires.([]any)
		if !is {
			return 0, &OmniError{Message: "omni: malformed OMNI requires list"}
		}
		for _, cap := range list {
			capstr, is := cap.(string)
			if !is || !slices.Contains(CAPABILITIES, capstr) {
				return 0, &OmniError{Message: "omni: spec requires unsupported capability: " + Stringify(cap)}
			}
		}
	}

	return int(version), nil
}

// checkentry is strict entry validation, applied when the spec declares
// version 1 or later. The lenient format converts each of these mistakes
// into a silent pass or a dead field; here they fail with the entry named.
func checkentry(flags Flags, index int, entry map[string]any) error {
	keys := make([]string, 0, len(entry))
	for key := range entry {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		if !slices.Contains(ENTRYFIELDS, key) {
			return fail(flags, index, entry, "unknown entry field: "+key, nil, nil)
		}
	}

	argsources := 0
	for _, key := range []string{"in", "args", "ctx"} {
		if _, has := entry[key]; has {
			argsources++
		}
	}
	if 1 < argsources {
		return fail(flags, index, entry, "entry has more than one of in, args, ctx", nil, nil)
	}

	if entryerr, has := entry["err"]; has && nil != entryerr {
		if _, has := entry["out"]; has {
			return fail(flags, index, entry, "entry has both err and out", nil, nil)
		}
	}

	if id, has := entry["id"]; has {
		if _, is := id.(string); !is {
			return fail(flags, index, entry, "entry id is not a string", nil, nil)
		}
	}

	return nil
}

// checkset validates a version-1 group up front, against the AUTHORED
// entries - null-normalisation would otherwise rewrite an authored null
// (e.g. id: null) into a sentinel string and hide it from validation. A
// malformed spec is a spec error, not a test result, so it fails before
// any subject runs.
func checkset(flags Flags, testspec any, normalset []any) error {
	origset := normalset
	var origmap map[string]any
	if tmap, is := testspec.(map[string]any); is {
		origmap = tmap
		if oset, is := tmap["set"].([]any); is {
			origset = oset
		}
	}

	if 0 == len(origset) {
		isempty, _ := origmap["empty"].(bool)
		if !isempty {
			return &OmniError{Message: "omni: empty test set: " + Stringify(flags["name"])}
		}
	}

	for index, rawentry := range origset {
		entry, is := rawentry.(map[string]any)
		if !is {
			return fail(flags, index, nil, "entry is not a map", nil, nil)
		}
		if err := checkentry(flags, index, entry); nil != err {
			return err
		}
	}

	return nil
}

// ResolveSpec finds `primary.<name>`, then `<name>`, then the whole spec.
func ResolveSpec(name string, alltests any) any {
	if "" == name {
		return alltests
	}

	if amap, is := alltests.(map[string]any); is {
		if primary, is := amap["primary"].(map[string]any); is {
			if section, has := primary[name]; has && nil != section {
				return section
			}
		}
		if section, has := amap[name]; has && nil != section {
			return section
		}
	}

	return alltests
}

func resolveclients(provider *Provider, spec any, store any) (map[string]*Provider, error) {
	clients := map[string]*Provider{}

	specmap, is := spec.(map[string]any)
	if !is {
		return clients, nil
	}

	defmap, is := specmap["DEF"].(map[string]any)
	if !is {
		return clients, nil
	}

	defclient, is := defmap["client"].(map[string]any)
	if !is {
		return clients, nil
	}

	// A spec may define clients that a given test run never references.
	if nil == provider.Client {
		return clients, nil
	}

	names := make([]string, 0, len(defclient))
	for name := range defclient {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, clientname := range names {
		copts := any(map[string]any{})
		if cdef, is := defclient[clientname].(map[string]any); is {
			if ctest, is := cdef["test"].(map[string]any); is {
				if options, has := ctest["options"]; has {
					copts = Clone(options)
				}
			}
		}

		if nil != provider.Inject && IsMap(store) {
			provider.Inject(copts, store)
		}

		client, err := provider.Client(copts)
		if nil != err {
			return nil, &OmniError{Message: "omni: cannot make client: " + clientname + ": " + err.Error()}
		}
		clients[clientname] = client
	}

	return clients, nil
}

func resolvesubject(name string, provider *Provider) Subject {
	if "" == name || nil == provider || nil == provider.Subject {
		return nil
	}
	return provider.Subject(name)
}

func resolveflags(flags Flags) Flags {
	out := Flags{}
	for key, val := range flags {
		out[key] = val
	}
	if _, has := out["null"]; !has {
		out["null"] = true
	}
	return out
}

func flagbool(flags Flags, name string) bool {
	val, has := flags[name]
	if !has || nil == val {
		return false
	}
	flag, is := val.(bool)
	return is && flag
}

// An entry with no `out` expects a null (or absent) result.
func resolveentry(entry map[string]any, flags Flags) map[string]any {
	if out, has := entry["out"]; (!has || nil == out) && flagbool(flags, "null") {
		entry["out"] = NULLMARK
	}
	return entry
}

type testpack struct {
	client  *Provider
	subject Subject
}

func resolvetestpack(
	name string,
	entry map[string]any,
	subject Subject,
	provider *Provider,
	clients map[string]*Provider,
) (*testpack, error) {
	pack := &testpack{client: provider, subject: subject}

	clientname, has := entry["client"].(string)
	if !has {
		return pack, nil
	}

	client, found := clients[clientname]
	if !found {
		return nil, &OmniError{Message: "omni: unknown client: " + clientname, Entry: entry}
	}

	pack.client = client
	if clientsubject := resolvesubject(name, client); nil != clientsubject {
		pack.subject = clientsubject
	}

	return pack, nil
}

// Build the argument list: `ctx`, `args`, or `in`.
func resolveargs(entry map[string]any, pack *testpack, provider *Provider) []any {
	var args []any

	ctx, hasctx := entry["ctx"]
	rawargs, hasargs := entry["args"]

	if hasctx {
		args = []any{ctx}
	} else if hasargs {
		if list, is := rawargs.([]any); is {
			args = list
		} else {
			args = []any{rawargs}
		}
	} else {
		args = []any{Clone(entry["in"])}
	}

	if (hasctx || hasargs) && 0 < len(args) {
		if first, is := args[0].(map[string]any); is {
			cloned := Clone(first)
			if nil != provider.Contextify {
				cloned = provider.Contextify(cloned)
			}
			if asmap, is := cloned.(map[string]any); is {
				asmap["client"] = pack.client
			}
			args[0] = cloned
			entry["ctx"] = cloned
		}
	}

	return args
}

// FixJson normalises a value: nulls (and absent values) become NULLMARK,
// errors become {name,message} maps, containers become []any/map[string]any.
// Always returns a fresh copy.
func FixJson(val any, flags Flags) any {
	donull := true
	if nil != flags {
		if raw, has := flags["null"]; has && nil != raw {
			flag, is := raw.(bool)
			donull = !is || flag
		}
	}
	return fixjsonval(val, donull)
}

func fixjsonval(val any, donull bool) any {
	if nil == val || IsAbsent(val) {
		if donull {
			return NULLMARK
		}
		return nil
	}

	if err, is := val.(error); is {
		return Errify(err)
	}

	switch typed := val.(type) {
	case string, bool, float64, float32,
		int, int8, int16, int32, int64,
		uint, uint8, uint16, uint32, uint64:
		return typed
	case []any:
		out := make([]any, len(typed))
		for index, entry := range typed {
			out[index] = fixjsonval(entry, donull)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(typed))
		for key, entry := range typed {
			out[key] = fixjsonval(entry, donull)
		}
		return out
	}

	// Any other Go container: normalise via reflection.
	value := reflect.ValueOf(val)
	switch value.Kind() {
	case reflect.Pointer, reflect.Interface:
		if value.IsNil() {
			if donull {
				return NULLMARK
			}
			return nil
		}
		return fixjsonval(value.Elem().Interface(), donull)
	case reflect.Slice, reflect.Array:
		out := make([]any, value.Len())
		for index := 0; index < value.Len(); index++ {
			out[index] = fixjsonval(value.Index(index).Interface(), donull)
		}
		return out
	case reflect.Map:
		out := make(map[string]any, value.Len())
		iter := value.MapRange()
		for iter.Next() {
			out[StrKey(iter.Key().Interface())] = fixjsonval(iter.Value().Interface(), donull)
		}
		return out
	}

	return val
}

// Errify is the JSON form of an error: always at least {name,message}.
func Errify(err any) map[string]any {
	if aserr, is := err.(error); is {
		name := reflect.TypeOf(aserr).String()
		if strings.HasPrefix(name, "*") {
			name = name[1:]
		}
		return map[string]any{"name": name, "message": aserr.Error()}
	}
	return map[string]any{"name": "Error", "message": fmt.Sprintf("%v", err)}
}

// errbase is the error base a `match.err` sees: the provider's own, when
// it has one.
func errbase(err any, provider *Provider) any {
	if nil != provider && nil != provider.Errify {
		return provider.Errify(err)
	}
	return Errify(err)
}

func errmessage(err error) string {
	if nil == err {
		return ""
	}
	return err.Error()
}

// The label of one entry, for failure messages.
func entryref(flags Flags, index int, entry map[string]any) string {
	label := "set"
	if name, is := flags["name"].(string); is && "" != name {
		label = name
	}
	entryid := ""
	if id, has := entry["id"]; has && nil != id {
		entryid = " (" + Stringify(id) + ")"
	}
	return fmt.Sprintf("%s[%d]%s", label, index, entryid)
}

func fail(flags Flags, index int, entry map[string]any, reason string, expected *string, actual *string) *OmniError {
	msg := "omni: " + entryref(flags, index, entry) + ": " + reason
	if nil != expected {
		msg += "\n  expected: " + *expected
	}
	if nil != actual {
		msg += "\n  actual:   " + *actual
	}
	msg += "\n  entry:    " + Stringify(entrysummary(entry))
	return &OmniError{Message: msg, Entry: entry}
}

func strptr(val string) *string {
	return &val
}

// The spec-defined part of an entry (drop runner bookkeeping).
func entrysummary(entry map[string]any) any {
	out := map[string]any{}
	for key, val := range entry {
		if "res" != key && "thrown" != key && "ctx" != key {
			out[key] = val
		}
	}
	return out
}

func checkresult(flags Flags, index int, entry map[string]any, args []any, res any) error {
	matched := false

	if entryerr, has := entry["err"]; has && nil != entryerr {
		return fail(flags, index, entry, "expected error did not occur",
			strptr(Stringify(entryerr)), strptr(Stringify(res)))
	}

	if check, has := entry["match"]; has && nil != check {
		base := map[string]any{
			"in":   entry["in"],
			"args": args,
			"out":  entry["res"],
			"ctx":  entry["ctx"],
		}
		if err := Match(flags, index, entry, check, base); nil != err {
			return err
		}
		matched = true
	}

	out := entry["out"]

	if DeepEqual(res, out) {
		return nil
	}

	// NOTE: a match with no explicit out is a complete check on its own.
	if matched && (NULLMARK == out || nil == out) {
		return nil
	}

	return fail(flags, index, entry, "result mismatch", strptr(Stringify(out)), strptr(Stringify(res)))
}

func handleerror(flags Flags, index int, entry map[string]any, err error, provider *Provider) error {
	entryerr, has := entry["err"]

	if has && nil != entryerr {
		istrue := false
		if flag, is := entryerr.(bool); is && flag {
			istrue = true
		}

		if istrue || MatchVal(entryerr, errmessage(err)) {
			if check, has := entry["match"]; has && nil != check {
				base := map[string]any{
					"in":  entry["in"],
					"out": entry["res"],
					"ctx": entry["ctx"],
					"err": errbase(err, provider),
				}
				return Match(flags, index, entry, check, base)
			}
			return nil
		}

		return fail(flags, index, entry, "error mismatch",
			strptr(Stringify(entryerr)), strptr(errmessage(err)))
	}

	return fail(flags, index, entry, "unexpected error", nil, strptr(errmessage(err)))
}

// Match checks that every leaf of `check` is present, and matches, in
// `base`.
func Match(flags Flags, index int, entry map[string]any, check any, base any) error {
	// Read the base DIRECTLY. The clone bought nothing - the walk below
	// only reads, via GetPath - and it blows the stack on a cyclic base. A
	// port driving entries with live objects rather than pure JSON produces
	// those routinely (voxgig/sdkgen's corpus matches a live client context
	// whose root context reaches the client again).
	cbase := base
	var failure error

	Walk(Clone(check), func(_key any, val any, _parent any, path []any) any {
		if nil != failure {
			return val
		}

		where := "<root>"
		if 0 < len(path) {
			where = PathIfy(path)
		}

		if IsNode(val) {
			return val
		}

		baseval := GetPath(cbase, path)

		// The sentinels are tested BEFORE the identity check below. Otherwise
		// a subject returning the literal string "__UNDEF__" satisfies an
		// assertion that the key is absent - two mutually exclusive states
		// passing one check. A sentinel that accepts its own literal is not a
		// sentinel. (NULLMARK still accepts NULLMARK: under the default null
		// flag a real null has already been normalised to it, so the two are
		// genuinely indistinguishable here - that one needs a raw-value
		// escape, not an ordering change.)

		// Explicitly absent: satisfied only by a genuinely missing key, never
		// by a present null (the distinction the sentinels exist to keep).
		if UNDEFMARK == val {
			if IsAbsent(baseval) {
				return val
			}
			failure = fail(flags, index, entry, "expected absent at "+where,
				strptr("absent"), strptr(Stringify(baseval)))
			return val
		}

		// Explicitly null: satisfied only by a present null.
		if NULLMARK == val {
			if nil == baseval || NULLMARK == baseval {
				return val
			}
			failure = fail(flags, index, entry, "expected null at "+where,
				strptr("null"), strptr(Stringify(baseval)))
			return val
		}

		// Explicitly present: any present value, including null.
		if EXISTSMARK == val {
			if !IsAbsent(baseval) {
				return val
			}
			failure = fail(flags, index, entry, "expected present at "+where,
				strptr("present"), strptr("absent"))
			return val
		}

		// Identical values match. This sits below the sentinel branches on
		// purpose - see the note above.
		if DeepEqual(val, baseval) {
			return val
		}

		// A concrete expectation never matches a missing key - a match leaf
		// against an absent value must fail, not substring-match "undefined".
		if IsAbsent(baseval) {
			failure = fail(flags, index, entry, "match failed at "+where,
				strptr(Stringify(val)), strptr("absent"))
			return val
		}

		if !MatchVal(val, baseval) {
			failure = fail(flags, index, entry, "match failed at "+where,
				strptr(Stringify(val)), strptr(Stringify(baseval)))
		}

		return val
	})

	return failure
}

// MatchVal matches one leaf: /regex/ or case-insensitive substring for
// strings.
func MatchVal(check any, base any) bool {
	if DeepEqual(check, base) {
		return true
	}

	want := check

	if nil == want {
		return nil == base || IsAbsent(base) || NULLMARK == base
	}

	if text, is := want.(string); is {
		// An empty want would substring-match anything: reject it.
		if "" == text {
			return false
		}

		basestr := Stringify(base)

		if strings.HasPrefix(text, "/") && strings.HasSuffix(text, "/") && 2 < len(text) {
			pattern, err := regexp.Compile(text[1 : len(text)-1])
			if nil != err {
				return false
			}
			return pattern.MatchString(basestr)
		}

		return strings.Contains(strings.ToLower(basestr), strings.ToLower(text))
	}

	return DeepEqual(want, base)
}

// NullModifier converts NULLMARK sentinels back into real nulls. Use as a
// Walk callback when a spec value must reach the subject as an actual null.
func NullModifier(key any, val any, parent any, _path []any) any {
	if text, is := val.(string); is {
		if NULLMARK == text {
			return nil
		}
		return strings.ReplaceAll(text, NULLMARK, "null")
	}
	return val
}

// Call a subject, converting a panic into an error.
func safecall(subject Subject, args []any) (res any, err error) {
	defer func() {
		if recovered := recover(); nil != recovered {
			if aserr, is := recovered.(error); is {
				err = aserr
			} else {
				err = fmt.Errorf("%v", recovered)
			}
		}
	}()

	return subject(args...)
}

// MakeRunner makes a runner for a spec file (or spec value) and a provider.
func MakeRunner(specref any, provider *Provider) (Runner, error) {
	alltests, err := LoadSpec(specref)
	if nil != err {
		return nil, err
	}

	specversion, err := resolveversion(alltests)
	if nil != err {
		return nil, err
	}

	useprovider := provider
	if nil == useprovider {
		useprovider = &Provider{}
	}

	return func(name string, store any) (*RunPack, error) {
		spec := ResolveSpec(name, alltests)

		clients, err := resolveclients(useprovider, spec, store)
		if nil != err {
			return nil, err
		}

		defsubject := resolvesubject(name, useprovider)

		runsetflags := func(testspec any, flags Flags, subject Subject) error {
			useflags := resolveflags(flags)
			if label, is := useflags["name"].(string); !is || "" == label {
				if "" != name {
					useflags["name"] = name
				} else {
					useflags["name"] = "set"
				}
			}

			usesubject := subject
			if nil == usesubject {
				usesubject = defsubject
			}
			if nil == usesubject {
				return &OmniError{Message: "omni: no test subject for: " + Stringify(useflags["name"])}
			}

			testspecmap, is := FixJson(testspec, useflags).(map[string]any)
			if !is {
				return &OmniError{Message: "omni: test spec has no set: " + Stringify(useflags["name"])}
			}

			testset, is := testspecmap["set"].([]any)
			if !is {
				return &OmniError{Message: "omni: test spec has no set: " + Stringify(useflags["name"])}
			}

			if 1 <= specversion {
				if err := checkset(useflags, testspec, testset); nil != err {
					return err
				}
			}

			for index, rawentry := range testset {
				entry, is := rawentry.(map[string]any)
				if !is {
					return &OmniError{
						Message: fmt.Sprintf("omni: %s[%d]: entry is not a map", useflags["name"], index),
					}
				}

				entry = resolveentry(entry, useflags)

				pack, err := resolvetestpack(name, entry, usesubject, useprovider, clients)
				if nil != err {
					return err
				}

				args := resolveargs(entry, pack, useprovider)

				res, subjecterr := safecall(pack.subject, args)

				if nil != subjecterr {
					if err := handleerror(useflags, index, entry, subjecterr, useprovider); nil != err {
						return err
					}
					continue
				}

				res = FixJson(res, useflags)
				entry["res"] = res

				if err := checkresult(useflags, index, entry, args, res); nil != err {
					return err
				}
			}

			return nil
		}

		runset := func(testspec any, subject Subject) error {
			return runsetflags(testspec, Flags{}, subject)
		}

		return &RunPack{
			Spec:        spec,
			RunSet:      runset,
			RunSetFlags: runsetflags,
			Subject:     defsubject,
			Client:      useprovider,
		}, nil
	}, nil
}

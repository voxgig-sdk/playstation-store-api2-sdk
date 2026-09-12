// VENDORED: @voxgig/omni sdk-20260908-1556-0 (go/util.go)
// Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// Omni internal JSON utilities.
//
// This file is deliberately self-contained: the omni runner must be able to
// test *any* library, including libraries that provide these same
// operations, so it can never borrow them from the system under test.
// Standard library only, by design.

package omni

import (
	"fmt"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
)

const (
	NULLMARK   = "__NULL__"   // Value is JSON null.
	UNDEFMARK  = "__UNDEF__"  // Value is not present (thus, undefined).
	EXISTSMARK = "__EXISTS__" // Value exists (not undefined).
)

// Absent is the marker for "no value at all", as distinct from a JSON null.
type Absent struct{}

// ABSENT is the single absence marker.
var ABSENT = Absent{}

// IsAbsent reports whether a value is the absence marker.
func IsAbsent(val any) bool {
	_, is := val.(Absent)
	return is
}

// IsMap reports whether a value is a map (JSON object).
func IsMap(val any) bool {
	_, is := val.(map[string]any)
	return is
}

// IsList reports whether a value is a list (JSON array).
func IsList(val any) bool {
	_, is := val.([]any)
	return is
}

// IsNode reports whether a value is a container (map or list).
func IsNode(val any) bool {
	return IsMap(val) || IsList(val)
}

// ToNum converts any Go numeric value to a float64. Booleans are not
// numbers.
func ToNum(val any) (float64, bool) {
	switch num := val.(type) {
	case float64:
		return num, true
	case float32:
		return float64(num), true
	case int:
		return float64(num), true
	case int8:
		return float64(num), true
	case int16:
		return float64(num), true
	case int32:
		return float64(num), true
	case int64:
		return float64(num), true
	case uint:
		return float64(num), true
	case uint8:
		return float64(num), true
	case uint16:
		return float64(num), true
	case uint32:
		return float64(num), true
	case uint64:
		return float64(num), true
	}
	return 0, false
}

// Clone deep copies a JSON value. Other values pass through by reference.
func Clone(val any) any {
	if list, is := val.([]any); is {
		out := make([]any, len(list))
		for index, entry := range list {
			out[index] = Clone(entry)
		}
		return out
	}

	if amap, is := val.(map[string]any); is {
		out := make(map[string]any, len(amap))
		for key, entry := range amap {
			out[key] = Clone(entry)
		}
		return out
	}

	return val
}

// GetPath reads a value by path. Returns ABSENT when any step is missing.
func GetPath(val any, path []any) any {
	current := val

	for _, part := range path {
		if list, is := current.([]any); is {
			index, ok := partindex(part)
			if !ok || index < 0 || index >= len(list) {
				return ABSENT
			}
			current = list[index]
			continue
		}

		if amap, is := current.(map[string]any); is {
			key := StrKey(part)
			entry, has := amap[key]
			if !has {
				return ABSENT
			}
			current = entry
			continue
		}

		return ABSENT
	}

	return current
}

func partindex(part any) (int, bool) {
	if num, is := ToNum(part); is {
		return int(num), true
	}
	if text, is := part.(string); is {
		index, err := strconv.Atoi(text)
		return index, nil == err
	}
	return 0, false
}

// StrKey renders a path part as a map key.
func StrKey(part any) string {
	if text, is := part.(string); is {
		return text
	}
	if num, is := ToNum(part); is {
		return NumStr(num)
	}
	return fmt.Sprintf("%v", part)
}

// Apply is the callback of a Walk.
type Apply func(key any, val any, parent any, path []any) any

// Walk is a depth-first walk: children first, then the containing node.
func Walk(val any, apply Apply) any {
	return walkdown(val, apply, nil, nil, []any{})
}

func walkdown(val any, apply Apply, key any, parent any, path []any) any {
	if list, is := val.([]any); is {
		for index := range list {
			childpath := append(append([]any{}, path...), index)
			list[index] = walkdown(list[index], apply, index, list, childpath)
		}
	} else if amap, is := val.(map[string]any); is {
		keys := make([]string, 0, len(amap))
		for childkey := range amap {
			keys = append(keys, childkey)
		}
		sort.Strings(keys)
		for _, childkey := range keys {
			childpath := append(append([]any{}, path...), childkey)
			amap[childkey] = walkdown(amap[childkey], apply, childkey, amap, childpath)
		}
	}

	return apply(key, val, parent, path)
}

// DeepEqual is deep structural equality: numbers by value, bools never
// numbers, map key order is not significant.
func DeepEqual(a any, b any) bool {
	abool, aisbool := a.(bool)
	bbool, bisbool := b.(bool)
	if aisbool || bisbool {
		return aisbool && bisbool && abool == bbool
	}

	anum, aisnum := ToNum(a)
	bnum, bisnum := ToNum(b)
	if aisnum || bisnum {
		return aisnum && bisnum && (anum == bnum || (math.IsNaN(anum) && math.IsNaN(bnum)))
	}

	if IsAbsent(a) || IsAbsent(b) {
		return IsAbsent(a) && IsAbsent(b)
	}

	if nil == a || nil == b {
		return nil == a && nil == b
	}

	alist, aislist := a.([]any)
	blist, bislist := b.([]any)
	if aislist || bislist {
		if !aislist || !bislist || len(alist) != len(blist) {
			return false
		}
		for index := range alist {
			if !DeepEqual(alist[index], blist[index]) {
				return false
			}
		}
		return true
	}

	amap, aismap := a.(map[string]any)
	bmap, bismap := b.(map[string]any)
	if aismap || bismap {
		if !aismap || !bismap || len(amap) != len(bmap) {
			return false
		}
		for key, val := range amap {
			other, has := bmap[key]
			if !has || !DeepEqual(val, other) {
				return false
			}
		}
		return true
	}

	astr, aisstr := a.(string)
	bstr, bisstr := b.(string)
	if aisstr || bisstr {
		return aisstr && bisstr && astr == bstr
	}

	return reflect.DeepEqual(a, b)
}

// NumStr renders a number the same way in every port: 5.0 prints as 5.
func NumStr(val float64) string {
	if math.IsNaN(val) || math.IsInf(val, 0) {
		return "null"
	}
	if val == math.Trunc(val) && math.Abs(val) < 9007199254740992.0 {
		return strconv.FormatInt(int64(val), 10)
	}
	return strconv.FormatFloat(val, 'g', -1, 64)
}

// Quote renders a string as a JSON string literal.
func Quote(val string) string {
	var out strings.Builder
	out.WriteByte('"')
	for _, char := range val {
		switch char {
		case '"':
			out.WriteString("\\\"")
		case '\\':
			out.WriteString("\\\\")
		case '\n':
			out.WriteString("\\n")
		case '\r':
			out.WriteString("\\r")
		case '\t':
			out.WriteString("\\t")
		default:
			if char < 0x20 {
				out.WriteString(fmt.Sprintf("\\u%04x", char))
			} else {
				out.WriteRune(char)
			}
		}
	}
	out.WriteByte('"')
	return out.String()
}

// JsonStr is compact JSON text with map keys sorted, so that messages are
// identical in every port regardless of local map ordering.
//
// GUARDED against cycles: this renders FAILURE MESSAGES, and an entry
// carrying a live cyclic value recursed until the stack gave out. A cycle
// renders as "[Circular]". The ancestor set tracks the CURRENT PATH only,
// removed again on the way out, so a DAG still renders in full.
func JsonStr(val any) string {
	return jsonstrSeen(val, map[uintptr]bool{})
}

func jsonstrSeen(val any, seen map[uintptr]bool) string {
	if IsAbsent(val) {
		return "undefined"
	}

	if nil == val {
		return "null"
	}

	if flag, is := val.(bool); is {
		if flag {
			return "true"
		}
		return "false"
	}

	if text, is := val.(string); is {
		return Quote(text)
	}

	if num, is := ToNum(val); is {
		return NumStr(num)
	}

	if list, is := val.([]any); is {
		ptr := reflect.ValueOf(list).Pointer()
		if seen[ptr] {
			return Quote("[Circular]")
		}
		seen[ptr] = true
		parts := make([]string, len(list))
		for index, entry := range list {
			parts[index] = jsonstrSeen(entry, seen)
		}
		delete(seen, ptr)
		return "[" + strings.Join(parts, ",") + "]"
	}

	if amap, is := val.(map[string]any); is {
		ptr := reflect.ValueOf(amap).Pointer()
		if seen[ptr] {
			return Quote("[Circular]")
		}
		seen[ptr] = true
		keys := make([]string, 0, len(amap))
		for key := range amap {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		parts := make([]string, len(keys))
		for index, key := range keys {
			parts[index] = Quote(key) + ":" + jsonstrSeen(amap[key], seen)
		}
		delete(seen, ptr)
		return "{" + strings.Join(parts, ",") + "}"
	}

	if reflect.ValueOf(val).Kind() == reflect.Func {
		return "[Function]"
	}

	return Quote(fmt.Sprintf("%v", val))
}

// Stringify renders strings verbatim, everything else as compact JSON.
func Stringify(val any) string {
	if text, is := val.(string); is {
		return text
	}
	return JsonStr(val)
}

// PathIfy renders a path as a dotted string.
func PathIfy(path []any) string {
	parts := make([]string, len(path))
	for index, part := range path {
		parts[index] = StrKey(part)
	}
	return strings.Join(parts, ".")
}

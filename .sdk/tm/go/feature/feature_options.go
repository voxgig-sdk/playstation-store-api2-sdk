package feature

import (
	"encoding/json"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// Shared option readers for the feature implementations. Options arrive as
// map[string]any, so a numeric value may be any numeric type; `json.Number` is
// what encoding/json produces under UseNumber().

func foptBool(options map[string]any, key string, def bool) bool {
	if options == nil {
		return def
	}
	if b, ok := options[key].(bool); ok {
		return b
	}
	return def
}

// Integers do not route through float64, which cannot hold large ones exactly.
func fnumInt(v any) (int, bool) {
	switch n := v.(type) {
	case int:
		return n, true
	case int8:
		return int(n), true
	case int16:
		return int(n), true
	case int32:
		return int(n), true
	case int64:
		return int(n), true
	case uint:
		return int(n), true
	case uint8:
		return int(n), true
	case uint16:
		return int(n), true
	case uint32:
		return int(n), true
	case uint64:
		return int(n), true
	case float32:
		return int(n), true
	case float64:
		return int(n), true
	case json.Number:
		if i, err := n.Int64(); err == nil {
			return int(i), true
		}
		if f, err := n.Float64(); err == nil {
			return int(f), true
		}
	}
	return rnumInt(v)
}

// A DEFINED numeric type (`type Retries int`) matches no type-switch arm, yet
// the option validator classifies it by reflect.Kind and passes it through.
// Reader and validator must agree on what counts as a number.
func rnumInt(v any) (int, bool) {
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return int(rv.Int()), true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return int(rv.Uint()), true
	case reflect.Float32, reflect.Float64:
		return int(rv.Float()), true
	}
	return 0, false
}

func fnumFloat(v any) (float64, bool) {
	switch n := v.(type) {
	case int:
		return float64(n), true
	case int8:
		return float64(n), true
	case int16:
		return float64(n), true
	case int32:
		return float64(n), true
	case int64:
		return float64(n), true
	case uint:
		return float64(n), true
	case uint8:
		return float64(n), true
	case uint16:
		return float64(n), true
	case uint32:
		return float64(n), true
	case uint64:
		return float64(n), true
	case float32:
		return float64(n), true
	case float64:
		return n, true
	case json.Number:
		if f, err := n.Float64(); err == nil {
			return f, true
		}
	}
	return rnumFloat(v)
}

func rnumFloat(v any) (float64, bool) {
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return float64(rv.Int()), true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return float64(rv.Uint()), true
	case reflect.Float32, reflect.Float64:
		return rv.Float(), true
	}
	return 0, false
}

func foptInt(options map[string]any, key string, def int) int {
	if options == nil {
		return def
	}
	if n, ok := fnumInt(options[key]); ok {
		return n
	}
	return def
}

func foptNum(options map[string]any, key string, def float64) float64 {
	if options == nil {
		return def
	}
	if n, ok := fnumFloat(options[key]); ok {
		return n
	}
	return def
}

func foptStr(options map[string]any, key string, def string) string {
	if options == nil {
		return def
	}
	if s, ok := options[key].(string); ok && s != "" {
		return s
	}
	return def
}

func foptMap(options map[string]any, key string) map[string]any {
	if options == nil {
		return nil
	}
	if m, ok := options[key].(map[string]any); ok {
		return m
	}
	return nil
}

func foptList(options map[string]any, key string) []any {
	if options == nil {
		return nil
	}
	if l, ok := options[key].([]any); ok {
		return l
	}
	return nil
}

// foptStrList reads a list option as strings ([]any or []string).
func foptStrList(options map[string]any, key string) []string {
	if options == nil {
		return nil
	}
	if sl, ok := options[key].([]string); ok {
		return sl
	}
	var out []string
	for _, v := range foptList(options, key) {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// foptSleep returns the injectable sleep (option "sleep": func(ms int)),
// defaulting to a real time.Sleep. Injected clocks keep tests deterministic.
func foptSleep(options map[string]any) func(ms int) {
	if options != nil {
		if fn, ok := options["sleep"].(func(int)); ok {
			return fn
		}
	}
	return func(ms int) {
		if ms > 0 {
			time.Sleep(time.Duration(ms) * time.Millisecond)
		}
	}
}

// foptNow returns the injectable clock (option "now": func() int64, ms),
// defaulting to the wall clock.
func foptNow(options map[string]any) func() int64 {
	if options != nil {
		if fn, ok := options["now"].(func() int64); ok {
			return fn
		}
	}
	return func() int64 {
		return time.Now().UnixMilli()
	}
}

// fheaderGet reads a header value case-insensitively.
func fheaderGet(headers map[string]any, name string) (any, bool) {
	if headers == nil {
		return nil, false
	}
	lower := strings.ToLower(name)
	for k, v := range headers {
		if strings.ToLower(k) == lower {
			return v, true
		}
	}
	return nil, false
}

// fheaderSetDefault sets a header only when no case-insensitive variant of
// it exists already (never clobber a caller-provided value).
func fheaderSetDefault(headers map[string]any, name string, value string) {
	if headers == nil {
		return
	}
	if _, has := fheaderGet(headers, name); has {
		return
	}
	headers[name] = value
}

// fresStatus extracts the numeric status from a transport-shaped response
// (map with a "status" entry). Returns ok=false when absent or non-numeric.
func fresStatus(res any) (int, bool) {
	rm, ok := res.(map[string]any)
	if !ok || rm == nil {
		return 0, false
	}
	switch n := rm["status"].(type) {
	case int:
		return n, true
	case int64:
		return int(n), true
	case float64:
		return int(n), true
	}
	return 0, false
}

// fresHeader reads a header from a transport-shaped response,
// case-insensitively, as a string.
func fresHeader(res any, name string) (string, bool) {
	rm, ok := res.(map[string]any)
	if !ok || rm == nil {
		return "", false
	}
	headers, ok := rm["headers"].(map[string]any)
	if !ok {
		return "", false
	}
	v, has := fheaderGet(headers, name)
	if !has {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

// fparseInt parses a decimal string; def when unparseable.
func fparseInt(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return def
	}
	return n
}


package sdktest

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"

	sdk "github.com/voxgig-sdk/playstation-store-api2-sdk/go"
)

var envLocalOnce sync.Once

func loadEnvLocal() {
	envLocalOnce.Do(func() {
		_, filename, _, _ := runtime.Caller(0)
		dir := filepath.Dir(filename)
		envFile := filepath.Join(dir, "..", "..", ".env.local")

		data, err := os.ReadFile(envFile)
		if err != nil {
			return
		}
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				os.Setenv(key, val)
			}
		}
	})
}

func envOverride(m map[string]any) map[string]any {
	if os.Getenv("PLAYSTATION_STORE_API2_TEST_LIVE") == "TRUE" ||
		os.Getenv("PLAYSTATION_STORE_API2_TEST_OVERRIDE") == "TRUE" {
		for key := range m {
			envval := os.Getenv(key)
			if envval != "" {
				envval = strings.TrimSpace(envval)
				if strings.HasPrefix(envval, "{") {
					var parsed any
					if err := json.Unmarshal([]byte(envval), &parsed); err == nil {
						m[key] = parsed
						continue
					}
				}
				m[key] = envval
			}
		}
	}

	if explain := os.Getenv("PLAYSTATION_STORE_API2_TEST_EXPLAIN"); explain != "" {
		m["PLAYSTATION_STORE_API2_TEST_EXPLAIN"] = explain
	}

	return m
}

type entityTestSetup struct {
	client        *sdk.PlaystationStoreApi2SDK
	data          map[string]any
	idmap         map[string]any
	env           map[string]any
	explain       bool
	live          bool
	syntheticOnly bool
	now           int64
}

var (
	cachedTestControl     map[string]any
	cachedTestControlOnce sync.Once
)

// loadTestControl reads sdk-test-control.json from this test dir; caches
// after first read. Returns an empty-skip default if the file is missing
// or invalid so tests never crash on a bad config.
func loadTestControl() map[string]any {
	cachedTestControlOnce.Do(func() {
		_, filename, _, _ := runtime.Caller(0)
		dir := filepath.Dir(filename)
		ctrlPath := filepath.Join(dir, "sdk-test-control.json")
		def := map[string]any{
			"version": 1,
			"test": map[string]any{"skip": map[string]any{
				"live": map[string]any{"direct": []any{}, "entityOp": []any{}},
				"unit": map[string]any{"direct": []any{}, "entityOp": []any{}},
			}},
		}
		data, err := os.ReadFile(ctrlPath)
		if err != nil {
			cachedTestControl = def
			return
		}
		var parsed map[string]any
		if err := json.Unmarshal(data, &parsed); err != nil {
			cachedTestControl = def
			return
		}
		cachedTestControl = parsed
	})
	return cachedTestControl
}

// isControlSkipped checks sdk-test-control.json for a skip entry.
// Returns (skip, reason).
func isControlSkipped(kind, name, mode string) (bool, string) {
	ctrl := loadTestControl()
	test, _ := ctrl["test"].(map[string]any)
	if test == nil {
		return false, ""
	}
	skip, _ := test["skip"].(map[string]any)
	if skip == nil {
		return false, ""
	}
	modeMap, _ := skip[mode].(map[string]any)
	if modeMap == nil {
		return false, ""
	}
	items, _ := modeMap[kind].([]any)
	for _, raw := range items {
		item, _ := raw.(map[string]any)
		if item == nil {
			continue
		}
		reason, _ := item["reason"].(string)
		if kind == "direct" {
			if t, _ := item["test"].(string); t == name {
				return true, reason
			}
		}
		if kind == "entityOp" {
			ent, _ := item["entity"].(string)
			op, _ := item["op"].(string)
			if ent+"."+op == name {
				return true, reason
			}
		}
	}
	return false, ""
}

var liveReserved = map[string]bool{
	"base": true, "prefix": true, "suffix": true,
	"server": true, "apikey": true, "secret": true,
}

func liveClientOptions() map[string]any {
	ctrl := loadTestControl()
	test, _ := ctrl["test"].(map[string]any)
	if test == nil {
		return map[string]any{}
	}
	client, _ := test["client"].(map[string]any)
	if client == nil {
		return map[string]any{}
	}
	opts, _ := client["options"].(map[string]any)
	if opts == nil {
		return map[string]any{}
	}

	out := map[string]any{}
	for k, v := range opts {
		if !liveReserved[k] {
			out[k] = v
		}
	}
	return out
}

func liveDelayMs() int {
	ctrl := loadTestControl()
	test, _ := ctrl["test"].(map[string]any)
	if test == nil {
		return 500
	}
	live, _ := test["live"].(map[string]any)
	if live == nil {
		return 500
	}
	switch v := live["delayMs"].(type) {
	case float64:
		if v >= 0 {
			return int(v)
		}
	case int:
		if v >= 0 {
			return v
		}
	}
	return 500
}

var cachedTestSpec map[string]any

func loadTestSpec(t *testing.T) map[string]any {
	t.Helper()
	if cachedTestSpec != nil {
		return cachedTestSpec
	}
	data, err := os.ReadFile("../../.sdk/test/test.json")
	if err != nil {
		t.Fatalf("Failed to load test.json: %v", err)
	}
	var spec map[string]any
	if err := json.Unmarshal(data, &spec); err != nil {
		t.Fatalf("Failed to parse test.json: %v", err)
	}
	cachedTestSpec = spec
	return spec
}

func getSpec(spec map[string]any, keys ...string) map[string]any {
	var cur any = spec
	for _, key := range keys {
		if m, ok := cur.(map[string]any); ok {
			cur = m[key]
		} else {
			return nil
		}
	}
	if m, ok := cur.(map[string]any); ok {
		return m
	}
	return nil
}

// entityData extracts the data map from an op result.
//
// Every entity operation resolves to the ENTITY (see AGENTS.md), so a flow
// test that wants the record takes this hop. A plain map passes through
// unchanged, so this is safe for the direct/prepare results too.
func entityData(v any) any {
	if ent, ok := v.(sdk.Entity); ok {
		return ent.Data()
	}
	return v
}

// entityListToData extracts data maps from a list of Entity objects.
func entityListToData(list []any) []any {
	var out []any
	for _, item := range list {
		if ent, ok := item.(sdk.Entity); ok {
			d := ent.Data()
			if dm, ok := d.(map[string]any); ok {
				out = append(out, dm)
			}
		} else if m, ok := item.(map[string]any); ok {
			out = append(out, m)
		}
	}
	if out == nil {
		out = []any{}
	}
	return out
}

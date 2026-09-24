package sdktest

import (
	"testing"

	sdk "github.com/voxgig-sdk/playstation-store-api2-sdk/go"
)

func TestCustomUtility(t *testing.T) {
	t.Run("basic", func(t *testing.T) {
		client := sdk.TestSDK(nil, map[string]any{
			"apikey": "APIKEY01",
			"utility": map[string]any{
				"auth":       func() map[string]any { return map[string]any{"util": "AUTH"} },
				"body":       func() map[string]any { return map[string]any{"util": "BODY"} },
				"contextify": func() map[string]any { return map[string]any{"util": "CONTEXTIFY"} },
				"done":       func() map[string]any { return map[string]any{"util": "DONE"} },
				"error":      func() map[string]any { return map[string]any{"util": "ERROR"} },
				"findparam":  func() map[string]any { return map[string]any{"util": "FINDPARAM"} },
				"fullurl":    func() map[string]any { return map[string]any{"util": "FULLURL"} },
				"headers":    func() map[string]any { return map[string]any{"util": "HEADERS"} },
				"method":     func() map[string]any { return map[string]any{"util": "METHOD"} },
				"operator":   func() map[string]any { return map[string]any{"util": "OPERATOR"} },
				"params":     func() map[string]any { return map[string]any{"util": "PARAMS"} },
				"query":      func() map[string]any { return map[string]any{"util": "QUERY"} },
				"reqform":    func() map[string]any { return map[string]any{"util": "REQFORM"} },
				"request":    func() map[string]any { return map[string]any{"util": "REQUEST"} },
				"resbasic":   func() map[string]any { return map[string]any{"util": "RESBASIC"} },
				"resbody":    func() map[string]any { return map[string]any{"util": "RESBODY"} },
				"resform":    func() map[string]any { return map[string]any{"util": "RESFORM"} },
				"resheaders": func() map[string]any { return map[string]any{"util": "RESHEADERS"} },
				"response":   func() map[string]any { return map[string]any{"util": "RESPONSE"} },
				"result":     func() map[string]any { return map[string]any{"util": "RESULT"} },
				"spec":       func() map[string]any { return map[string]any{"util": "SPEC"} },
			},
		})

		u := client.GetUtility()

		checks := map[string]string{
			"auth":       "AUTH",
			"body":       "BODY",
			"contextify": "CONTEXTIFY",
			"done":       "DONE",
			"error":      "ERROR",
			"findparam":  "FINDPARAM",
			"fullurl":    "FULLURL",
			"headers":    "HEADERS",
			"method":     "METHOD",
			"operator":   "OPERATOR",
			"params":     "PARAMS",
			"query":      "QUERY",
			"reqform":    "REQFORM",
			"request":    "REQUEST",
			"resbasic":   "RESBASIC",
			"resbody":    "RESBODY",
			"resform":    "RESFORM",
			"resheaders": "RESHEADERS",
			"response":   "RESPONSE",
			"result":     "RESULT",
			"spec":       "SPEC",
		}

		for key, expected := range checks {
			fn, ok := u.Custom[key]
			if !ok {
				t.Errorf("expected custom utility %q to exist", key)
				continue
			}
			if f, ok := fn.(func() map[string]any); ok {
				result := f()
				if result["util"] != expected {
					t.Errorf("custom utility %q: got %v, want %v", key, result["util"], expected)
				}
			} else {
				t.Errorf("custom utility %q: expected func() map[string]any, got %T", key, fn)
			}
		}
	})

	t.Run("a real utility member is replaced, not shelved", func(t *testing.T) {
		reached := 0
		scripted := func(ctx *sdk.Context, fullurl string, fetchdef map[string]any) (any, error) {
			reached++
			return map[string]any{
				"status":     200,
				"statusText": "OK",
				"headers":    map[string]any{},
				"body":       map[string]any{"ok": true},
			}, nil
		}

		client := sdk.NewPlaystationStoreApi2SDK(map[string]any{
			"test":    map[string]any{"active": true},
			"utility": map[string]any{"fetcher": scripted},
		})

		u := client.GetUtility()

		if u.Fetcher == nil {
			t.Fatal("Fetcher is nil")
		}
		if _, shelved := u.Custom["fetcher"]; shelved {
			t.Error("fetcher was shelved in Custom instead of replacing the member")
		}

		// Behaviour, not identity: a func value cannot be compared, so drive it.
		ctx := u.MakeContext(map[string]any{}, client.GetRootCtx())
		if _, err := u.Fetcher(ctx, "http://example.test/probe", map[string]any{}); err != nil {
			t.Fatalf("scripted fetcher returned an error: %v", err)
		}
		if reached != 1 {
			t.Errorf("the scripted fetcher was not installed: reached %d times, want 1", reached)
		}
	})

	t.Run("a converted fetcher is accepted too", func(t *testing.T) {
		reached := 0
		// "test" is the OPTION, not the `test` FEATURE: it says "this client
		// is not live", so a REQUIRED OpenAPI server variable resolves to a
		// deterministic test-<name> instead of panicking at construction. It
		// installs no transport, so the override under test still stands.
		client := sdk.NewPlaystationStoreApi2SDK(map[string]any{
			"test": map[string]any{"active": true},
			"utility": map[string]any{
				"fetcher": sdk.FetcherFunc(func(
					ctx *sdk.Context, fullurl string, fetchdef map[string]any,
				) (any, error) {
					reached++
					return map[string]any{
						"status":     200,
						"statusText": "OK",
						"headers":    map[string]any{},
						"body":       map[string]any{"ok": true},
					}, nil
				}),
			},
		})

		u := client.GetUtility()
		if _, shelved := u.Custom["fetcher"]; shelved {
			t.Error("a converted fetcher was shelved in Custom")
		}

		ctx := u.MakeContext(map[string]any{}, client.GetRootCtx())
		if _, err := u.Fetcher(ctx, "http://example.test/probe", map[string]any{}); err != nil {
			t.Fatalf("scripted fetcher returned an error: %v", err)
		}
		if reached != 1 {
			t.Errorf("the converted fetcher was not installed: reached %d times, want 1", reached)
		}
	})

	t.Run("an unknown key is still attached", func(t *testing.T) {
		// "test" is the OPTION, not the `test` FEATURE: it says "this client
		// is not live", so a REQUIRED OpenAPI server variable resolves to a
		// deterministic test-<name> instead of panicking at construction. It
		// installs no transport, so the override under test still stands.
		client := sdk.NewPlaystationStoreApi2SDK(map[string]any{
			"test": map[string]any{"active": true},
			"utility": map[string]any{
				"notAUtilityMember": func() string { return "EXTRA" },
			},
		})
		if _, ok := client.GetUtility().Custom["notAUtilityMember"]; !ok {
			t.Error("an unknown utility key was dropped instead of kept in Custom")
		}
	})
}

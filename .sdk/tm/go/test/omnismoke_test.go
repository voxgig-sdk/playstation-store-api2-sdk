// Smoke tests for the vendored omni runner itself: a runner that cannot
// FAIL a bad entry would turn every corpus suite vacuously green, so pin
// the failure paths, not just the happy one. (The go peer of
// tm/ts/test/omni.test.ts.)

package sdktest

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	sdk "GOMODULE"
)

// omniRecorder captures RunSet failures, so a test can assert that a
// failure HAPPENED without itself failing - RunSet reports through
// TestingT rather than returning an error.
type omniRecorder struct {
	failures []string
}

func (rec *omniRecorder) Helper() {}

func (rec *omniRecorder) Error(args ...any) {
	rec.failures = append(rec.failures, fmt.Sprint(args...))
}

// A minimal in-memory spec: no fixture file, no OMNI block (lenient v0,
// like the shared corpus).
func omniSmokeSpec() map[string]any {
	return map[string]any{
		"primary": map[string]any{
			"smoke": map[string]any{
				"basic": map[string]any{
					"set": []any{
						map[string]any{"in": 1, "out": 2},
						map[string]any{"in": 41, "out": 42},
					},
				},
				"bad": map[string]any{
					"set": []any{
						map[string]any{"in": 1, "out": 999},
					},
				},
				"err": map[string]any{
					"set": []any{
						map[string]any{"in": 0, "err": "zero refused"},
					},
				},
			},
		},
	}
}

func omniSmokeInc(n int) (any, error) {
	if 0 == n {
		return nil, errors.New("smoke: zero refused")
	}
	return n + 1, nil
}

func omniSmokeRun(t *testing.T) *RunPack {
	t.Helper()
	runner := MakeRunner(omniSmokeSpec(), sdk.TestSDK(nil, nil))
	run, err := runner("smoke", nil)
	if err != nil {
		t.Fatalf("smoke runner failed to resolve: %v", err)
	}
	return run
}

func TestOmniRunner(t *testing.T) {

	t.Run("runset passes a correct subject", func(t *testing.T) {
		run := omniSmokeRun(t)
		run.RunSet(t, run.Spec["basic"], omniSmokeInc)
	})

	t.Run("runset FAILS a wrong result", func(t *testing.T) {
		run := omniSmokeRun(t)
		rec := &omniRecorder{}

		run.RunSet(rec, run.Spec["bad"], omniSmokeInc)

		if 0 == len(rec.failures) {
			t.Fatal("a wrong result went unreported - the corpus suites would be vacuously green")
		}
		if !strings.Contains(rec.failures[0], "result mismatch") {
			t.Fatalf("expected a result mismatch failure, got: %s", rec.failures[0])
		}
	})

	t.Run("an expected error is matched, an unexpected one fails", func(t *testing.T) {
		run := omniSmokeRun(t)

		run.RunSet(t, run.Spec["err"], omniSmokeInc)

		rec := &omniRecorder{}
		run.RunSet(rec, run.Spec["err"], func(n int) (any, error) {
			return n, nil
		})

		if 0 == len(rec.failures) {
			t.Fatal("a missing expected error went unreported")
		}
		if !strings.Contains(rec.failures[0], "expected error did not occur") {
			t.Fatalf("expected an expected-error failure, got: %s", rec.failures[0])
		}
	})
}

package sdktest

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	sdk "github.com/voxgig-sdk/playstation-store-api2-sdk/go"
	"github.com/voxgig-sdk/playstation-store-api2-sdk/go/core"

	vs "github.com/voxgig-sdk/playstation-store-api2-sdk/go/utility/struct"
)

func TestContainerEntity(t *testing.T) {
	t.Run("instance", func(t *testing.T) {
		testsdk := sdk.TestSDK(nil, nil)
		ent := testsdk.Container(nil)
		if ent == nil {
			t.Fatal("expected non-nil ContainerEntity")
		}
	})

	t.Run("basic", func(t *testing.T) {
		setup := containerBasicSetup(nil)
		// Per-op sdk-test-control.json skip — basic test exercises a flow
		// with multiple ops; skipping any op skips the whole flow.
		_mode := "unit"
		if setup.live {
			_mode = "live"
		}
		for _, _op := range []string{"list"} {
			if _shouldSkip, _reason := isControlSkipped("entityOp", "container." + _op, _mode); _shouldSkip {
				if _reason == "" {
					_reason = "skipped via sdk-test-control.json"
				}
				t.Skip(_reason)
				return
			}
		}
		// The basic flow consumes synthetic IDs from the fixture. In live mode
		// without an *_ENTID env override, those IDs hit the live API and 4xx.
		if setup.syntheticOnly {
			t.Skip("live entity test uses synthetic IDs from fixture — set PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID JSON to run live")
			return
		}
		client := setup.client

		// Bootstrap entity data from existing test data (no create step in flow).
		containerRef01DataRaw := vs.Items(core.ToMapAny(vs.GetPath("existing.container", setup.data)))
		var containerRef01Data map[string]any
		if len(containerRef01DataRaw) > 0 {
			containerRef01Data = core.ToMapAny(containerRef01DataRaw[0][1])
		}
		// Discard guards against Go's unused-var check when the flow's steps
		// happen not to consume the bootstrap data (e.g. list-only flows).
		_ = containerRef01Data

		// LIST
		containerRef01Ent := client.Container(nil)
		containerRef01Match := map[string]any{
			"age_limit": setup.idmap["age_limit01"],
			"container_id": setup.idmap["container01"],
			"country": setup.idmap["country01"],
			"language": setup.idmap["language01"],
		}

		containerRef01ListResult, err := containerRef01Ent.List(containerRef01Match, nil)
		if err != nil {
			t.Fatalf("list failed: %v", err)
		}
		_, containerRef01ListOk := containerRef01ListResult.([]any)
		if !containerRef01ListOk {
			t.Fatalf("expected list result to be an array, got %T", containerRef01ListResult)
		}

	})
}

func containerBasicSetup(extra map[string]any) *entityTestSetup {
	loadEnvLocal()

	_, filename, _, _ := runtime.Caller(0)
	dir := filepath.Dir(filename)

	entityDataFile := filepath.Join(dir, "..", "..", ".sdk", "test", "entity", "container", "ContainerTestData.json")

	entityDataSource, err := os.ReadFile(entityDataFile)
	if err != nil {
		panic("failed to read container test data: " + err.Error())
	}

	var entityData map[string]any
	if err := json.Unmarshal(entityDataSource, &entityData); err != nil {
		panic("failed to parse container test data: " + err.Error())
	}

	options := map[string]any{}
	options["entity"] = entityData["existing"]

	client := sdk.TestSDK(options, extra)

	// Generate idmap via transform, matching TS pattern.
	idmap := vs.Transform(
		[]any{"container01", "container02", "container03", "age_limit01", "country01", "language01"},
		map[string]any{
			"`$PACK`": []any{"", map[string]any{
				"`$KEY`": "`$COPY`",
				"`$VAL`": []any{"`$FORMAT`", "upper", "`$COPY`"},
			}},
		},
	)

	// Detect ENTID env override before envOverride consumes it. When live
	// mode is on without a real override, the basic test runs against synthetic
	// IDs from the fixture and 4xx's. Surface this so the test can skip.
	entidEnvRaw := os.Getenv("PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID")
	idmapOverridden := entidEnvRaw != "" && strings.HasPrefix(strings.TrimSpace(entidEnvRaw), "{")

	env := envOverride(map[string]any{
		"PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID": idmap,
		"PLAYSTATIONSTOREAPI__TEST_LIVE":      "FALSE",
		"PLAYSTATIONSTOREAPI__TEST_EXPLAIN":   "FALSE",
	})

	idmapResolved := core.ToMapAny(env["PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID"])
	if idmapResolved == nil {
		idmapResolved = core.ToMapAny(idmap)
	}

	if env["PLAYSTATIONSTOREAPI__TEST_LIVE"] == "TRUE" {
		mergedOpts := vs.Merge([]any{
			map[string]any{
			},
			extra,
		})
		client = sdk.NewPlaystationStoreApi2SDK(core.ToMapAny(mergedOpts))
	}

	live := env["PLAYSTATIONSTOREAPI__TEST_LIVE"] == "TRUE"
	return &entityTestSetup{
		client:        client,
		data:          entityData,
		idmap:         idmapResolved,
		env:           env,
		explain:       env["PLAYSTATIONSTOREAPI__TEST_EXPLAIN"] == "TRUE",
		live:          live,
		syntheticOnly: live && !idmapOverridden,
		now:           time.Now().UnixMilli(),
	}
}

<?php
declare(strict_types=1);

// Container entity test

require_once __DIR__ . '/../playstationstoreapi2_sdk.php';
require_once __DIR__ . '/Runner.php';

use PHPUnit\Framework\TestCase;
use Voxgig\Struct\Struct as Vs;

class ContainerEntityTest extends TestCase
{
    public function test_create_instance(): void
    {
        $testsdk = PlaystationStoreApi2SDK::test(null, null);
        $ent = $testsdk->Container(null);
        $this->assertNotNull($ent);
    }

    public function test_basic_flow(): void
    {
        $setup = container_basic_setup(null);
        // Per-op sdk-test-control.json skip.
        $_live = !empty($setup["live"]);
        foreach (["list"] as $_op) {
            [$_shouldSkip, $_reason] = Runner::is_control_skipped("entityOp", "container." . $_op, $_live ? "live" : "unit");
            if ($_shouldSkip) {
                $this->markTestSkipped($_reason ?? "skipped via sdk-test-control.json");
                return;
            }
        }
        // The basic flow consumes synthetic IDs from the fixture. In live mode
        // without an *_ENTID env override, those IDs hit the live API and 4xx.
        if (!empty($setup["synthetic_only"])) {
            $this->markTestSkipped("live entity test uses synthetic IDs from fixture — set PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID JSON to run live");
            return;
        }
        $client = $setup["client"];

        // Bootstrap entity data from existing test data.
        $container_ref01_data_raw = Vs::items(Helpers::to_map(
            Vs::getpath($setup["data"], "existing.container")));
        $container_ref01_data = null;
        if (count($container_ref01_data_raw) > 0) {
            $container_ref01_data = Helpers::to_map($container_ref01_data_raw[0][1]);
        }

        // LIST
        $container_ref01_ent = $client->Container(null);
        $container_ref01_match = [
            "age_limit" => $setup["idmap"]["age_limit01"],
            "container_id" => $setup["idmap"]["container01"],
            "country" => $setup["idmap"]["country01"],
            "language" => $setup["idmap"]["language01"],
        ];

        [$container_ref01_list_result, $err] = $container_ref01_ent->list($container_ref01_match, null);
        $this->assertNull($err);
        $this->assertIsArray($container_ref01_list_result);

    }
}

function container_basic_setup($extra)
{
    Runner::load_env_local();

    $entity_data_file = __DIR__ . '/../../.sdk/test/entity/container/ContainerTestData.json';
    $entity_data_source = file_get_contents($entity_data_file);
    $entity_data = json_decode($entity_data_source, true);

    $options = [];
    $options["entity"] = $entity_data["existing"];

    $client = PlaystationStoreApi2SDK::test($options, $extra);

    // Generate idmap.
    $idmap = [];
    foreach (["container01", "container02", "container03", "age_limit01", "country01", "language01"] as $k) {
        $idmap[$k] = strtoupper($k);
    }

    // Detect ENTID env override before envOverride consumes it. When live
    // mode is on without a real override, the basic test runs against synthetic
    // IDs from the fixture and 4xx's. Surface this so the test can skip.
    $entid_env_raw = getenv("PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID");
    $idmap_overridden = $entid_env_raw !== false && str_starts_with(trim($entid_env_raw), "{");

    $env = Runner::env_override([
        "PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID" => $idmap,
        "PLAYSTATIONSTOREAPI__TEST_LIVE" => "FALSE",
        "PLAYSTATIONSTOREAPI__TEST_EXPLAIN" => "FALSE",
    ]);

    $idmap_resolved = Helpers::to_map(
        $env["PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID"]);
    if ($idmap_resolved === null) {
        $idmap_resolved = Helpers::to_map($idmap);
    }

    if ($env["PLAYSTATIONSTOREAPI__TEST_LIVE"] === "TRUE") {
        $merged_opts = Vs::merge([
            [
            ],
            $extra ?? [],
        ]);
        $client = new PlaystationStoreApi2SDK(Helpers::to_map($merged_opts));
    }

    $live = $env["PLAYSTATIONSTOREAPI__TEST_LIVE"] === "TRUE";
    return [
        "client" => $client,
        "data" => $entity_data,
        "idmap" => $idmap_resolved,
        "env" => $env,
        "explain" => $env["PLAYSTATIONSTOREAPI__TEST_EXPLAIN"] === "TRUE",
        "live" => $live,
        "synthetic_only" => $live && !$idmap_overridden,
        "now" => (int)(microtime(true) * 1000),
    ];
}

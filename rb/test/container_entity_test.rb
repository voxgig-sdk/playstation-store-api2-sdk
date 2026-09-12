# Container entity test

require "minitest/autorun"
require "json"
require_relative "../PlaystationStoreApi2_sdk"
require_relative "runner"

class ContainerEntityTest < Minitest::Test
  def test_create_instance
    testsdk = PlaystationStoreApi2SDK.test(nil, nil)
    ent = testsdk.Container(nil)
    assert !ent.nil?
  end

  def test_basic_flow
    setup = container_basic_setup(nil)
    # Per-op sdk-test-control.json skip.
    _live = setup[:live] || false
    ["load"].each do |_op|
      _should_skip, _reason = Runner.is_control_skipped("entityOp", "container." + _op, _live ? "live" : "unit")
      if _should_skip
        skip(_reason || "skipped via sdk-test-control.json")
        return
      end
    end
    # The basic flow consumes synthetic IDs from the fixture. In live mode
    # without an *_ENTID env override, those IDs hit the live API and 4xx.
    if setup[:synthetic_only]
      skip "live entity test uses synthetic IDs from fixture — set PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID JSON to run live"
      return
    end
    client = setup[:client]

    # Bootstrap entity data from existing test data.
    container_ref01_data_raw = Vs.items(Helpers.to_map(
      Vs.getpath(setup[:data], "existing.container")))
    container_ref01_data = nil
    if container_ref01_data_raw.length > 0
      container_ref01_data = Helpers.to_map(container_ref01_data_raw[0][1])
    end

    # LOAD
    container_ref01_ent = client.Container(nil)
    container_ref01_match_dt0 = {
      "id" => container_ref01_data["id"],
    }
    container_ref01_data_dt0_loaded = container_ref01_ent.load(container_ref01_match_dt0, nil)
    container_ref01_data_dt0_load_result = Helpers.to_map(container_ref01_data_dt0_loaded.respond_to?(:data_get) ? container_ref01_data_dt0_loaded.data_get : container_ref01_data_dt0_loaded)
    assert !container_ref01_data_dt0_load_result.nil?
    assert_equal container_ref01_data_dt0_load_result["id"], container_ref01_data["id"]

  end
end

def container_basic_setup(extra)
  Runner.load_env_local

  entity_data_file = File.join(__dir__, "..", "..", ".sdk", "test", "entity", "container", "ContainerTestData.json")
  entity_data_source = File.read(entity_data_file)
  entity_data = JSON.parse(entity_data_source)

  options = {}
  options["entity"] = entity_data["existing"]

  client = PlaystationStoreApi2SDK.test(options, extra)

  # Generate idmap via transform.
  idmap = Vs.transform(
    ["container01", "container02", "container03", "age_limit01", "country01", "language01"],
    {
      "`$PACK`" => ["", {
        "`$KEY`" => "`$COPY`",
        "`$VAL`" => ["`$FORMAT`", "upper", "`$COPY`"],
      }],
    }
  )

  # Detect ENTID env override before envOverride consumes it. When live
  # mode is on without a real override, the basic test runs against synthetic
  # IDs from the fixture and 4xx's. Surface this so the test can skip.
  entid_env_raw = ENV["PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID"]
  idmap_overridden = !entid_env_raw.nil? && entid_env_raw.strip.start_with?("{")

  env = Runner.env_override({
    "PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID" => idmap,
    "PLAYSTATION_STORE_API2_TEST_LIVE" => "FALSE",
    "PLAYSTATION_STORE_API2_TEST_EXPLAIN" => "FALSE",
  })

  idmap_resolved = Helpers.to_map(
    env["PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID"])
  if idmap_resolved.nil?
    idmap_resolved = Helpers.to_map(idmap)
  end

  if env["PLAYSTATION_STORE_API2_TEST_LIVE"] == "TRUE"
    merged_opts = Vs.merge([
      # FIRST, so the generated fields below win: sdk-test-control.json's
      # test.client.options adds to the live client, it does not redirect it.
      Runner.live_client_options,
      {
      },
      extra || {},
    ])
    client = PlaystationStoreApi2SDK.new(Helpers.to_map(merged_opts))
  end

  live = env["PLAYSTATION_STORE_API2_TEST_LIVE"] == "TRUE"
  {
    client: client,
    data: entity_data,
    idmap: idmap_resolved,
    env: env,
    explain: env["PLAYSTATION_STORE_API2_TEST_EXPLAIN"] == "TRUE",
    live: live,
    synthetic_only: live && !idmap_overridden,
    now: (Time.now.to_f * 1000).to_i,
  }
end

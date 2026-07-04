-- Container entity test

local json = require("dkjson")
local vs = require("utility.struct.struct")
local sdk = require("playstation-store-api2_sdk")
local helpers = require("core.helpers")
local runner = require("test.runner")

local _test_dir = debug.getinfo(1, "S").source:match("^@(.+/)")  or "./"

describe("ContainerEntity", function()
  it("should create instance", function()
    local testsdk = sdk.test(nil, nil)
    local ent = testsdk:Container(nil)
    assert.is_not_nil(ent)
  end)

  it("should run basic flow", function()
    local setup = container_basic_setup(nil)
    -- Per-op sdk-test-control.json skip.
    local _live = setup.live or false
    for _, _op in ipairs({"list"}) do
      local _should_skip, _reason = runner.is_control_skipped("entityOp", "container." .. _op, _live and "live" or "unit")
      if _should_skip then
        pending(_reason or "skipped via sdk-test-control.json")
        return
      end
    end
    -- The basic flow consumes synthetic IDs from the fixture. In live mode
    -- without an *_ENTID env override, those IDs hit the live API and 4xx.
    if setup.synthetic_only then
      pending("live entity test uses synthetic IDs from fixture — set PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID JSON to run live")
      return
    end
    local client = setup.client

    -- Bootstrap entity data from existing test data.
    local container_ref01_data_raw = vs.items(helpers.to_map(
      vs.getpath(setup.data, "existing.container")))
    local container_ref01_data = nil
    if #container_ref01_data_raw > 0 then
      container_ref01_data = helpers.to_map(container_ref01_data_raw[1][2])
    end

    -- LIST
    local container_ref01_ent = client:Container(nil)
    local container_ref01_match = {
      ["age_limit"] = setup.idmap["age_limit01"],
      ["container_id"] = setup.idmap["container01"],
      ["country"] = setup.idmap["country01"],
      ["language"] = setup.idmap["language01"],
    }

    local container_ref01_list_result, err = container_ref01_ent:list(container_ref01_match, nil)
    assert.is_nil(err)
    assert.is_table(container_ref01_list_result)

  end)
end)

function container_basic_setup(extra)
  runner.load_env_local()

  local entity_data_file = _test_dir .. "../../.sdk/test/entity/container/ContainerTestData.json"
  local f = io.open(entity_data_file, "r")
  if f == nil then
    error("failed to read container test data: " .. entity_data_file)
  end
  local entity_data_source = f:read("*a")
  f:close()

  local entity_data = json.decode(entity_data_source)

  local options = {}
  options["entity"] = entity_data["existing"]

  local client = sdk.test(options, extra)

  -- Generate idmap via transform.
  local idmap = vs.transform(
    { "container01", "container02", "container03", "age_limit01", "country01", "language01" },
    {
      ["`$PACK`"] = { "", {
        ["`$KEY`"] = "`$COPY`",
        ["`$VAL`"] = { "`$FORMAT`", "upper", "`$COPY`" },
      }},
    }
  )

  -- Detect ENTID env override before envOverride consumes it. When live
  -- mode is on without a real override, the basic test runs against synthetic
  -- IDs from the fixture and 4xx's. Surface this so the test can skip.
  local entid_env_raw = os.getenv("PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID")
  local idmap_overridden = entid_env_raw ~= nil and entid_env_raw:match("^%s*{") ~= nil

  local env = runner.env_override({
    ["PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID"] = idmap,
    ["PLAYSTATIONSTOREAPI__TEST_LIVE"] = "FALSE",
    ["PLAYSTATIONSTOREAPI__TEST_EXPLAIN"] = "FALSE",
  })

  local idmap_resolved = helpers.to_map(
    env["PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID"])
  if idmap_resolved == nil then
    idmap_resolved = helpers.to_map(idmap)
  end

  if env["PLAYSTATIONSTOREAPI__TEST_LIVE"] == "TRUE" then
    local merged_opts = vs.merge({
      {
      },
      extra or {},
    })
    client = sdk.new(helpers.to_map(merged_opts))
  end

  local live = env["PLAYSTATIONSTOREAPI__TEST_LIVE"] == "TRUE"
  return {
    client = client,
    data = entity_data,
    idmap = idmap_resolved,
    env = env,
    explain = env["PLAYSTATIONSTOREAPI__TEST_EXPLAIN"] == "TRUE",
    live = live,
    synthetic_only = live and not idmap_overridden,
    now = os.time() * 1000,
  }
end

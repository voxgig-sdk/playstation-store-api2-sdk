# Container direct test

require "minitest/autorun"
require "json"
require_relative "../PlaystationStoreApi2_sdk"
require_relative "runner"

class ContainerDirectTest < Minitest::Test
  def test_direct_list_container
    setup = container_direct_setup([
      { "id" => "direct01" },
      { "id" => "direct02" },
    ])
    _should_skip, _reason = Runner.is_control_skipped("direct", "direct-list-container", setup[:live] ? "live" : "unit")
    if _should_skip
      skip(_reason || "skipped via sdk-test-control.json")
      return
    end
    if setup[:live]
      ["age_limit01", "container01", "country01", "language01"].each do |_live_key|
        if setup[:idmap][_live_key].nil?
          skip "live test needs #{_live_key} via *_ENTID env var (synthetic IDs only)"
          return
        end
      end
    end
    client = setup[:client]

    params = {}
    if setup[:live]
      params["age_limit"] = setup[:idmap]["age_limit01"]
    else
      params["age_limit"] = "direct01"
    end
    if setup[:live]
      params["container_id"] = setup[:idmap]["container01"]
    else
      params["container_id"] = "direct01"
    end
    if setup[:live]
      params["country"] = setup[:idmap]["country01"]
    else
      params["country"] = "direct01"
    end
    if setup[:live]
      params["language"] = setup[:idmap]["language01"]
    else
      params["language"] = "direct01"
    end

    result, err = client.direct({
      "path" => "container/{country}/{language}/{age_limit}/{container_id}",
      "method" => "GET",
      "params" => params,
    })
    if setup[:live]
      # Live mode is lenient: synthetic IDs frequently 4xx and the list-
      # response shape varies wildly across public APIs. Skip rather than
      # fail when the call doesn't return a usable list.
      if !err.nil?
        skip("list call failed (likely synthetic IDs against live API): #{err}")
        return
      end
      unless result["ok"]
        skip("list call not ok (likely synthetic IDs against live API)")
        return
      end
      status = Helpers.to_int(result["status"])
      if status < 200 || status >= 300
        skip("expected 2xx status, got #{status}")
        return
      end
    else
      assert_nil err
      assert result["ok"]
      assert_equal 200, Helpers.to_int(result["status"])
      assert result["data"].is_a?(Array)
      assert_equal 2, result["data"].length
      assert_equal 1, setup[:calls].length
    end
  end

end


def container_direct_setup(mockres)
  Runner.load_env_local

  calls = []

  env = Runner.env_override({
    "PLAYSTATIONSTOREAPI__TEST_CONTAINER_ENTID" => {},
    "PLAYSTATIONSTOREAPI__TEST_LIVE" => "FALSE",
  })

  live = env["PLAYSTATIONSTOREAPI__TEST_LIVE"] == "TRUE"

  if live
    merged_opts = {
    }
    client = PlaystationStoreApi2SDK.new(merged_opts)
    return {
      client: client,
      calls: calls,
      live: true,
      idmap: {},
    }
  end

  mock_fetch = ->(url, init) {
    calls.push({ "url" => url, "init" => init })
    return {
      "status" => 200,
      "statusText" => "OK",
      "headers" => {},
      "json" => ->() {
        if !mockres.nil?
          return mockres
        end
        return { "id" => "direct01" }
      },
      "body" => "mock",
    }, nil
  }

  client = PlaystationStoreApi2SDK.new({
    "base" => "http://localhost:8080",
    "system" => {
      "fetch" => mock_fetch,
    },
  })

  {
    client: client,
    calls: calls,
    live: false,
    idmap: {},
  }
end

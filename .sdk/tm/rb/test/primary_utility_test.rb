# PlaystationStoreApi2 SDK primary utility test
#
# Corpus sections run through the vendored omni runner, via the resolver
# in test/omni.rb (struct-runner shape over native voxgig_omni). The
# inline corpus engine this file used to carry is retired: omni resolves
# arguments, applies the null rules, and enforces out/err/match - the
# subjects below only adapt each utility's calling convention.
#
# Two conventions to know when adding a section:
#
# - Utilities that answer as a `return value, err` TUPLE go through
#   `unwrap`, which raises the err so omni can match it against `err:`
#   expectations. Utilities that answer bare values (or raise) are passed
#   straight in.
#
# - `match: {ctx: ...}` assertions read the LIVE context after the
#   subject ran - the resolver's ObjView takes care of presenting the
#   context object as the map omni walks, camelCase keys included.

require "minitest/autorun"
require "json"
require_relative "../PlaystationStoreApi2_sdk"
require_relative "omni"

class PrimaryUtilityTest < Minitest::Test

  # Resolved against test/omni.rb's own directory, so the suite works
  # from any working directory.
  TEST_JSON_FILE = "../../.sdk/test/test.json"

  # Sections deliberately left empty in the shared corpus
  # (.sdk/test/primary/<name>.aon carries a PENDING header). Everything
  # else MUST contribute cases.
  PENDING = %w[
    fetcher makeFetchDef makeResult
    featureAdd featureHook featureInit
  ].freeze

  def setup
    @runner = PlaystationStoreApi2Omni.make_runner(TEST_JSON_FILE, PlaystationStoreApi2SDK.test(nil, nil))
    @run = @runner.call("primary")

    @spec = @run[:spec]
    @runset = @run[:runset]
    @runsetflags = @run[:runsetflags]

    # Under the old inline runner the suite drove the SDK directly; under
    # omni the runpack's client is the provider wrapping it. This suite
    # treats the client as the SDK - so unwrap the real instance
    # (mirrors ts).
    @client = @run[:client][:sdk]
    @utility = @client.get_utility
  end

  # Run one corpus section, failing loudly when it would run ZERO cases.
  # A renamed section or a fixture that compiled to an empty `set` used
  # to pass silently, which defeats the point of a shared oracle. EVERY
  # corpus-backed test goes through here (mirrors ts).
  def runsection(name, subject)
    section = @spec.is_a?(Hash) ? @spec[name] : nil
    refute_nil section,
      "test corpus section '#{name}' missing - check the name against .sdk/test/primary/"
    basic = section.is_a?(Hash) ? section["basic"] : nil
    assert basic.is_a?(Hash) && basic["set"].is_a?(Array),
      "test corpus section '#{name}' has no basic.set list"
    if basic["set"].empty? && !PENDING.include?(name)
      flunk "test corpus section '#{name}' is EMPTY - zero cases would run; " \
            "add cases, or mark the fixture PENDING in .sdk/test/primary/"
    end
    @runset.call(basic, subject)
  end

  # `return value, err` tuple convention -> value-or-raise, omni's shape.
  def unwrap(pair)
    value, err = pair
    raise err unless err.nil?
    value
  end

  def err_from_map(m)
    return nil unless m.is_a?(Hash)
    msg = m["message"]
    return nil unless msg.is_a?(String) && !msg.empty?
    PlaystationStoreApi2Error.new(m["code"] || "", msg)
  end


  # === exists ===

  def test_exists
    assert @utility.clean, "clean should not be nil"
    assert @utility.done, "done should not be nil"
    assert @utility.make_error, "make_error should not be nil"
    assert @utility.feature_add, "feature_add should not be nil"
    assert @utility.feature_hook, "feature_hook should not be nil"
    assert @utility.feature_init, "feature_init should not be nil"
    assert @utility.fetcher, "fetcher should not be nil"
    assert @utility.make_fetch_def, "make_fetch_def should not be nil"
    assert @utility.make_context, "make_context should not be nil"
    assert @utility.make_options, "make_options should not be nil"
    assert @utility.make_request, "make_request should not be nil"
    assert @utility.make_response, "make_response should not be nil"
    assert @utility.make_result, "make_result should not be nil"
    assert @utility.make_point, "make_point should not be nil"
    assert @utility.make_spec, "make_spec should not be nil"
    assert @utility.make_url, "make_url should not be nil"
    assert @utility.param, "param should not be nil"
    assert @utility.prepare_auth, "prepare_auth should not be nil"
    assert @utility.prepare_body, "prepare_body should not be nil"
    assert @utility.prepare_headers, "prepare_headers should not be nil"
    assert @utility.prepare_method, "prepare_method should not be nil"
    assert @utility.prepare_params, "prepare_params should not be nil"
    assert @utility.prepare_path, "prepare_path should not be nil"
    assert @utility.prepare_query, "prepare_query should not be nil"
    assert @utility.result_basic, "result_basic should not be nil"
    assert @utility.result_body, "result_body should not be nil"
    assert @utility.result_headers, "result_headers should not be nil"
    assert @utility.transform_request, "transform_request should not be nil"
    assert @utility.transform_response, "transform_response should not be nil"
  end


  # === clean ===

  def test_clean_basic
    ctx = make_test_ctx(@client, @utility, nil)
    val = { "key" => "secret123", "name" => "test" }
    cleaned = @utility.clean.call(ctx, val)
    assert cleaned, "clean should return a value"
  end


  # === done ===

  def test_done_basic
    runsection("done", ->(ctx) { @utility.done.call(ctx) })
  end


  # === makeError ===

  def test_make_error_basic
    subject = lambda do |ctx, errmap = nil|
      err = errmap.is_a?(Hash) ? err_from_map(errmap) : nil
      # make_error raises the constructed exception on the default
      # (throw) path; omni matches it against the entry's err.
      @utility.make_error.call(ctx, err)
    end

    runsection("makeError", subject)
  end

  def test_make_error_no_throw
    ctx = make_test_full_ctx(@client, @utility)
    ctx.ctrl.throw_err = false
    ctx.result = PlaystationStoreApi2Result.new({
      "ok" => false,
      "resdata" => { "id" => "safe01" },
    })

    # throw_err is false: make_error returns the bare result data instead
    # of raising (the result-object / no-throw escape hatch).
    out = @utility.make_error.call(ctx, ctx.make_error("test_code", "test message"))
    assert out.is_a?(Hash)
    assert_equal "safe01", out["id"]
  end


  # === featureAdd ===

  def test_feature_add_basic
    ctx = make_test_ctx(@client, @utility, nil)
    start_len = @client.features.length

    feature = PlaystationStoreApi2BaseFeature.new
    @utility.feature_add.call(ctx, feature)

    assert_equal start_len + 1, @client.features.length
  end


  # === featureHook ===

  def test_feature_hook_basic
    hook_client = PlaystationStoreApi2SDK.test(nil, nil)
    hook_utility = hook_client.get_utility
    ctx = make_test_ctx(hook_client, hook_utility, nil)

    called = false
    hook_feature = TestHookFeature.new { called = true }
    hook_client.features = [hook_feature]

    hook_utility.feature_hook.call(ctx, "TestHook")
    assert called, "hook should have been called"
  end


  # === featureInit ===

  def test_feature_init_basic
    init_client = PlaystationStoreApi2SDK.test(nil, nil)
    init_utility = init_client.get_utility
    ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      "initfeat" => { "active" => true },
    }

    called = false
    feature = TestInitFeature.new("initfeat", true) { called = true }
    init_utility.feature_init.call(ctx, feature)
    assert called, "init should have been called"
  end

  def test_feature_init_inactive
    init_client = PlaystationStoreApi2SDK.test(nil, nil)
    init_utility = init_client.get_utility
    ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      "nofeat" => { "active" => false },
    }

    called = false
    feature = TestInitFeature.new("nofeat", false) { called = true }
    init_utility.feature_init.call(ctx, feature)
    assert_equal false, called, "init should not have been called"
  end


  # === fetcher ===

  def test_fetcher_live
    calls = []
    live_client = PlaystationStoreApi2SDK.new({
      # Concrete base: a live construction must satisfy any server
      # variables a templated base URL declares; a literal base sidesteps
      # the requirement.
      "base" => "http://localhost:8080",
      "system" => {
        "fetch" => lambda { |url, fetchdef|
          calls << { "url" => url, "init" => fetchdef }
          [{ "status" => 200, "statusText" => "OK" }, nil]
        },
      },
    })
    live_utility = live_client.get_utility
    ctx = live_utility.make_context.call({
      "opname" => "load",
      "client" => live_client,
      "utility" => live_utility,
    }, nil)

    fetchdef = { "method" => "GET", "headers" => {} }
    _, err = live_utility.fetcher.call(ctx, "http://example.com/test", fetchdef)
    assert_nil err
    assert_equal 1, calls.length
    assert_equal "http://example.com/test", calls[0]["url"]
  end

  def test_fetcher_blocked_test_mode
    blocked_client = PlaystationStoreApi2SDK.new({
      "base" => "http://localhost:8080",
      "system" => {
        "fetch" => lambda { |_url, _fetchdef| [{}, nil] },
      },
    })
    blocked_client.mode = "test"

    blocked_utility = blocked_client.get_utility
    ctx = blocked_utility.make_context.call({
      "opname" => "load",
      "client" => blocked_client,
      "utility" => blocked_utility,
    }, nil)

    fetchdef = { "method" => "GET", "headers" => {} }
    _, err = blocked_utility.fetcher.call(ctx, "http://example.com/test", fetchdef)
    assert err, "expected blocked error"
    assert_includes err.to_s.downcase, "blocked"
  end


  # === makeContext ===

  def test_make_context_basic
    subject = lambda do |vin|
      next nil unless vin.is_a?(Hash)

      ctx = @utility.make_context.call(vin, nil)
      out = { "id" => ctx.id }
      if ctx.op
        out["op"] = {
          "name" => ctx.op.name,
          "input" => ctx.op.input,
        }
      end
      out
    end

    runsection("makeContext", subject)
  end


  # === makeFetchDef ===

  def test_make_fetch_def_basic
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = PlaystationStoreApi2Spec.new({
      "base" => "http://localhost:8080",
      "prefix" => "/api",
      "path" => "items/{id}",
      "suffix" => "",
      "params" => { "id" => "item01" },
      "query" => {},
      "headers" => { "content-type" => "application/json" },
      "method" => "GET",
      "step" => "start",
    })
    ctx.result = PlaystationStoreApi2Result.new({})

    fetchdef, err = @utility.make_fetch_def.call(ctx)
    assert_nil err, "should not be error: #{err}"
    assert_equal "GET", fetchdef["method"]
    url = fetchdef["url"] || ""
    assert_includes url, "/api/items/item01"
    assert_equal "application/json", fetchdef["headers"]["content-type"]
    assert_nil fetchdef["body"], "expected nil body"
  end

  def test_make_fetch_def_with_body
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = PlaystationStoreApi2Spec.new({
      "base" => "http://localhost:8080",
      "prefix" => "",
      "path" => "items",
      "suffix" => "",
      "params" => {},
      "query" => {},
      "headers" => {},
      "method" => "POST",
      "step" => "start",
      "body" => { "name" => "test" },
    })
    ctx.result = PlaystationStoreApi2Result.new({})

    fetchdef, err = @utility.make_fetch_def.call(ctx)
    assert_nil err, "should not be error: #{err}"
    assert_equal "POST", fetchdef["method"]
    body_str = fetchdef["body"]
    assert body_str.is_a?(String), "expected body string, got #{body_str.class}"
    assert_includes body_str, "\"name\""
  end


  # === makeOptions ===

  def test_make_options_basic
    subject = lambda do |vin|
      vin = {} unless vin.is_a?(Hash)
      ctx = @utility.make_context.call({
        "options" => vin["options"],
        "config" => vin["config"],
      }, nil)
      ctx.client = @client
      ctx.utility = @utility
      @utility.make_options.call(ctx)
    end

    runsection("makeOptions", subject)
  end


  # === makeRequest ===

  def test_make_request_basic
    runsection("makeRequest", ->(ctx) { unwrap(@utility.make_request.call(ctx)) })
  end


  # === makeResponse ===

  def test_make_response_basic
    runsection("makeResponse", ->(ctx) { unwrap(@utility.make_response.call(ctx)) })
  end


  # === makeResult ===

  def test_make_result_basic
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = PlaystationStoreApi2Spec.new({
      "base" => "http://localhost:8080",
      "prefix" => "/api",
      "path" => "items/{id}",
      "suffix" => "",
      "params" => { "id" => "item01" },
      "query" => {},
      "headers" => {},
      "method" => "GET",
      "step" => "start",
    })
    ctx.result = PlaystationStoreApi2Result.new({
      "ok" => true,
      "status" => 200,
      "statusText" => "OK",
      "headers" => {},
      "resdata" => { "id" => "item01", "name" => "Test" },
    })

    result, err = @utility.make_result.call(ctx)
    assert_nil err, "expected no error, got: #{err}"
    assert_equal 200, result.status
  end

  def test_make_result_no_spec
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = nil
    ctx.result = PlaystationStoreApi2Result.new({
      "ok" => true,
      "status" => 200,
      "statusText" => "OK",
      "headers" => {},
    })

    _, err = @utility.make_result.call(ctx)
    assert err, "expected error for nil spec"
  end

  def test_make_result_no_result
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = PlaystationStoreApi2Spec.new({ "step" => "start" })
    ctx.result = nil

    _, err = @utility.make_result.call(ctx)
    assert err, "expected error for nil result"
  end


  # === makeSpec ===

  def test_make_spec_basic
    setup_opts = @spec.dig("makeSpec", "DEF", "setup", "a")
    spec_client = PlaystationStoreApi2SDK.test(nil, setup_opts)

    subject = lambda do |ctx|
      ctx.client = spec_client
      ctx.options = spec_client.options_map
      unwrap(@utility.make_spec.call(ctx))
    end

    runsection("makeSpec", subject)
  end


  # === makePoint ===

  def test_make_point_basic
    # Driven from the corpus like every other section. The corpus asserts
    # refusals by code (`match: {out: {code: ...}}`), so an error is the
    # RESULT here - answered as its attribute map, because the vendored
    # runner's own errify keeps only {name,message} (see test/omni.rb).
    subject = lambda do |ctx|
      point, err = @utility.make_point.call(ctx)
      err.nil? ? point : PlaystationStoreApi2Omni.errify(err)
    end

    runsection("makePoint", subject)
  end

  def test_make_point_single
    ctx = make_test_ctx(@client, @utility, nil)
    point = {
      "parts" => ["items", "{id}"],
      "args" => { "params" => [] },
      "params" => [],
      "alias" => {},
      "select" => {},
      "active" => true,
      "transform" => {},
    }
    ctx.op.points = [point]

    _, err = @utility.make_point.call(ctx)
    assert_nil err, "expected no error, got: #{err}"
    assert ctx.point, "expected point to be set"
  end


  # === makeUrl ===

  def test_make_url_basic
    subject = lambda do |ctx|
      ctx.result = PlaystationStoreApi2Result.new({}) unless ctx.result
      unwrap(@utility.make_url.call(ctx))
    end

    runsection("makeUrl", subject)
  end


  # === operator ===

  def test_operator_basic
    subject = lambda do |vin|
      vin = {} unless vin.is_a?(Hash)
      op = PlaystationStoreApi2Operation.new(vin)
      {
        "entity" => op.entity,
        "name" => op.name,
        "input" => op.input,
        "points" => op.points,
      }
    end

    runsection("operator", subject)
  end


  # === param ===

  def test_param_basic
    runsection("param", ->(ctx, name = nil) { @utility.param.call(ctx, name) })
  end


  # === prepareAuth ===

  def test_prepare_auth_basic
    setup_opts = @spec.dig("prepareAuth", "DEF", "setup", "a")
    auth_client = PlaystationStoreApi2SDK.test(nil, setup_opts)

    subject = lambda do |ctx|
      ctx.client = auth_client
      unwrap(@utility.prepare_auth.call(ctx))
    end

    runsection("prepareAuth", subject)
  end


  # === prepareBody ===

  def test_prepare_body_basic
    runsection("prepareBody", ->(ctx) { @utility.prepare_body.call(ctx) })
  end


  # === prepareHeaders ===

  def test_prepare_headers_basic
    runsection("prepareHeaders", ->(ctx) { @utility.prepare_headers.call(ctx) })
  end


  # === prepareMethod ===

  def test_prepare_method_basic
    runsection("prepareMethod", ->(ctx) { @utility.prepare_method.call(ctx) })
  end


  # === prepareParams ===

  def test_prepare_params_basic
    runsection("prepareParams", ->(ctx) { @utility.prepare_params.call(ctx) })
  end


  # === preparePath ===

  def test_prepare_path_basic
    runsection("preparePath", ->(ctx) { @utility.prepare_path.call(ctx) })
  end

  def test_prepare_path_single
    ctx = make_test_full_ctx(@client, @utility)
    ctx.point = {
      "parts" => ["items"],
      "args" => { "params" => [] },
    }

    path = @utility.prepare_path.call(ctx)
    assert_equal "items", path
  end


  # === prepareQuery ===

  def test_prepare_query_basic
    runsection("prepareQuery", ->(ctx) { @utility.prepare_query.call(ctx) })
  end


  # === resultBasic ===

  def test_result_basic_basic
    subject = lambda do |ctx|
      result = @utility.result_basic.call(ctx)
      out = {
        "status" => result.status,
        "statusText" => result.status_text,
      }
      out["err"] = { "message" => result.err.to_s } if result.err
      out
    end

    runsection("resultBasic", subject)
  end


  # === resultBody ===

  def test_result_body_basic
    runsection("resultBody", ->(ctx) { @utility.result_body.call(ctx) })
  end


  # === resultHeaders ===

  def test_result_headers_basic
    runsection("resultHeaders", ->(ctx) { @utility.result_headers.call(ctx) })
  end


  # === transformRequest ===

  def test_transform_request_basic
    runsection("transformRequest", ->(ctx) { @utility.transform_request.call(ctx) })
  end


  # === transformResponse ===

  def test_transform_response_basic
    runsection("transformResponse", ->(ctx) { @utility.transform_response.call(ctx) })
  end


  private

  # === Helper: make_test_ctx ===
  def make_test_ctx(client, utility, overrides)
    ctxmap = {
      "opname" => "load",
      "client" => client,
      "utility" => utility,
    }
    if overrides
      overrides.each { |k, v| ctxmap[k] = v }
    end
    utility.make_context.call(ctxmap, client.get_root_ctx)
  end

  # === Helper: make_test_full_ctx ===
  def make_test_full_ctx(client, utility)
    ctx = make_test_ctx(client, utility, nil)
    ctx.point = {
      "parts" => ["items", "{id}"],
      "args" => { "params" => [{ "name" => "id", "reqd" => true }] },
      "params" => ["id"],
      "alias" => {},
      "select" => {},
      "active" => true,
      "transform" => {},
    }
    ctx.match = { "id" => "item01" }
    ctx.reqmatch = { "id" => "item01" }
    ctx
  end
end


# === Test hook feature for featureHook test ===
class TestHookFeature < PlaystationStoreApi2BaseFeature
  def initialize(&hook_fn)
    super()
    @hook_fn = hook_fn
  end

  def TestHook(ctx)
    @hook_fn.call if @hook_fn
  end
end


# === Test init feature for featureInit test ===
class TestInitFeature < PlaystationStoreApi2BaseFeature
  def initialize(name, active, &init_fn)
    super()
    @name = name
    @active = active
    @init_fn = init_fn
  end

  def get_name; @name; end
  def get_active; @active; end

  def init(ctx, options)
    @init_fn.call if @init_fn
  end
end

# PlaystationStoreApi2 SDK pipeline test
#
# Direct unit tests for the operation-pipeline utilities. The generated
# entity tests exercise the happy path; these drive the error and edge
# branches (missing spec/response/result, 4xx handling, transport
# failures, feature ordering, auth header shaping) that a normal
# success-path op never reaches. All utilities are reached through the
# client's utility view, so this suite is API-agnostic.

require "minitest/autorun"
require "json"
require_relative "../PlaystationStoreApi2_sdk"

class PipelineTest < Minitest::Test
  def setup
    @client = PlaystationStoreApi2SDK.test(nil, nil)
    @utility = @client.get_utility
  end

  # Fake client so the exact options shape is controlled (prepare_auth).
  class OptClient
    def initialize(options)
      @options = options
    end

    def options_map
      out = VoxgigStruct.clone(@options)
      out.is_a?(Hash) ? out : {}
    end
  end

  def make_ctx(opname: "load", client: nil, utility: nil)
    utility ||= @utility
    ctx = utility.make_context.call({
      "opname" => opname,
      "client" => client || @client,
      "utility" => utility,
    }, nil)
    ctx.options = ctx.client.options_map if ctx.options.nil? && ctx.client.respond_to?(:options_map)
    ctx
  end

  # Transport-shaped response with a re-readable body + lowercase headers.
  def resp(status, data = nil, headers = nil)
    h = {}
    (headers || {}).each { |k, v| h[k.to_s.downcase] = v }
    PlaystationStoreApi2Response.new({
      "status" => status,
      "statusText" => status < 400 ? "OK" : "ERR",
      "body" => "body",
      "json" => -> { data },
      "headers" => h,
    })
  end

  def spec_of(map = {})
    PlaystationStoreApi2Spec.new({ "step" => "s", "method" => "GET", "headers" => {} }.merge(map))
  end

  # A utility view whose fetcher (or other member) is overridden.
  def util_with(fetcher)
    u = @client.get_utility
    u.fetcher = fetcher
    u
  end


  # === feature order (feature #2) ===
  # options["feature"] accepts an ordered ARRAY (developer add-order) or a map
  # (defaults test-first); make_options records the resolved order in
  # __derived__.featureorder.

  def resolve_order(feature)
    ctx = @utility.make_context.call({
      "client" => @client,
      "utility" => @utility,
    }, nil)
    ctx.options = { "feature" => feature }
    ctx.config = { "options" => {} }
    opts = @utility.make_options.call(ctx)
    (opts["__derived__"]["featureorder"] || []).join(",")
  end

  def test_feature_order_map_is_test_first
    assert_equal "test,metrics", resolve_order({
      "metrics" => { "active" => true },
      "test" => { "active" => true },
    })
  end

  def test_feature_order_array_preserves_order
    assert_equal "metrics,test", resolve_order([
      { "name" => "metrics", "active" => true },
      { "name" => "test", "active" => true },
    ])
  end

  def test_feature_order_no_test_deterministic
    assert_equal "cache,retry", resolve_order({
      "retry" => { "active" => true },
      "cache" => { "active" => true },
    })
  end


  # === make_point ===

  def test_make_point_rejects_a_disallowed_operation
    ctx = make_ctx(opname: "nope")
    _, err = @utility.make_point.call(ctx)
    assert_equal "point_op_allow", err.code
  end

  def test_make_point_rejects_an_operation_with_no_endpoints
    ctx = make_ctx
    ctx.op.points = []
    _, err = @utility.make_point.call(ctx)
    assert_equal "point_no_points", err.code
  end

  def test_make_point_returns_the_single_point
    ctx = make_ctx
    point = { "parts" => ["a"], "args" => { "params" => [] } }
    ctx.op.points = [point]
    out, err = @utility.make_point.call(ctx)
    assert_nil err
    assert_equal point, out
  end

  def test_make_point_short_circuits_a_feature_supplied_point
    ctx = make_ctx
    preset = { "parts" => ["a"] }
    ctx.out["point"] = preset
    out, err = @utility.make_point.call(ctx)
    assert_nil err
    assert_equal preset, out
  end

  def test_make_point_surfaces_a_feature_supplied_error
    # The PrePoint short-circuit analog: a feature (e.g. rbac) places an
    # error in ctx.out["point"]; make_point must fail before any network.
    ctx = make_ctx
    denial = ctx.make_error("rbac_denied", "denied")
    ctx.out["point"] = denial
    out, err = @utility.make_point.call(ctx)
    assert_nil out
    assert_equal "rbac_denied", err.code
  end


  # === make_spec ===

  def test_make_spec_short_circuits_a_feature_supplied_spec
    ctx = make_ctx
    preset = spec_of("method" => "GET")
    ctx.out["spec"] = preset
    out, err = @utility.make_spec.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_response ===

  def test_make_response_guards_missing_spec_response_result
    ctx = make_ctx
    ctx.spec = nil
    ctx.response = resp(200)
    ctx.result = PlaystationStoreApi2Result.new({})
    _, err = @utility.make_response.call(ctx)
    assert_equal "response_no_spec", err.code

    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = nil
    ctx.result = PlaystationStoreApi2Result.new({})
    _, err = @utility.make_response.call(ctx)
    assert_equal "response_no_response", err.code

    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = resp(200)
    ctx.result = nil
    _, err = @utility.make_response.call(ctx)
    assert_equal "response_no_result", err.code
  end

  def test_make_response_4xx_sets_result_err_and_copies_headers
    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = resp(404, nil, { "x-a" => "1" })
    ctx.result = PlaystationStoreApi2Result.new({})
    _, err = @utility.make_response.call(ctx)
    assert_nil err
    refute_nil ctx.result.err
    assert_equal 404, ctx.result.status
    assert_equal "1", ctx.result.headers["x-a"]
    assert_equal false, ctx.result.ok
  end

  def test_make_response_2xx_parses_the_body_and_marks_ok
    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = resp(200, { "v" => 1 })
    ctx.result = PlaystationStoreApi2Result.new({})
    _, err = @utility.make_response.call(ctx)
    assert_nil err
    assert_equal true, ctx.result.ok
    assert_equal({ "v" => 1 }, ctx.result.body)
  end

  def test_make_response_records_to_ctrl_explain
    ctx = make_ctx
    ctx.ctrl.explain = {}
    ctx.spec = spec_of
    ctx.response = resp(200, { "v" => 2 })
    ctx.result = PlaystationStoreApi2Result.new({})
    @utility.make_response.call(ctx)
    refute_nil ctx.ctrl.explain["result"]
  end

  def test_make_response_short_circuits_a_feature_supplied_response
    ctx = make_ctx
    preset = resp(299)
    ctx.out["response"] = preset
    ctx.spec = spec_of
    ctx.response = resp(200)
    ctx.result = PlaystationStoreApi2Result.new({})
    out, err = @utility.make_response.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_result ===

  def test_make_result_guards_missing_spec_and_result
    ctx = make_ctx
    ctx.spec = nil
    ctx.result = PlaystationStoreApi2Result.new({})
    _, err = @utility.make_result.call(ctx)
    assert_equal "result_no_spec", err.code

    ctx = make_ctx
    ctx.spec = spec_of
    ctx.result = nil
    _, err = @utility.make_result.call(ctx)
    assert_equal "result_no_result", err.code
  end

  def make_fake_entity(made)
    fake = Object.new
    fake.define_singleton_method(:make) do
      rec = Object.new
      rec.define_singleton_method(:data_set) { |d| made << d }
      rec
    end
    fake
  end

  def test_make_result_list_op_wraps_resdata_into_entities
    made = []
    ctx = @utility.make_context.call({
      "opname" => "list",
      "client" => @client,
      "utility" => @utility,
      "entity" => make_fake_entity(made),
    }, nil)
    ctx.spec = spec_of
    ctx.result = PlaystationStoreApi2Result.new({
      "ok" => true, "resdata" => [{ "a" => 1 }, { "a" => 2 }],
    })
    result, err = @utility.make_result.call(ctx)
    assert_nil err
    assert_equal 2, result.resdata.length
    assert_equal 2, made.length
    assert_equal [{ "a" => 1 }, { "a" => 2 }], made
  end

  def test_make_result_empty_list_yields_an_empty_resdata_array
    made = []
    ctx = @utility.make_context.call({
      "opname" => "list",
      "client" => @client,
      "utility" => @utility,
      "entity" => make_fake_entity(made),
    }, nil)
    ctx.spec = spec_of
    ctx.result = PlaystationStoreApi2Result.new({ "ok" => true, "resdata" => [] })
    result, err = @utility.make_result.call(ctx)
    assert_nil err
    assert_equal [], result.resdata
  end

  def test_make_result_short_circuits_a_preset_result
    ctx = make_ctx
    preset = PlaystationStoreApi2Result.new({ "ok" => true })
    ctx.out["result"] = preset
    out, err = @utility.make_result.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_request ===

  def test_make_request_guards_a_missing_spec
    ctx = make_ctx
    ctx.spec = nil
    _, err = @utility.make_request.call(ctx)
    assert_equal "request_no_spec", err.code
  end

  def request_spec
    spec_of("base" => "http://h", "path" => "a")
  end

  def test_make_request_a_transport_error_tuple_lands_on_the_response
    boom = PlaystationStoreApi2Error.new("boom", "boom")
    u = util_with(->(_c, _u, _f) { [nil, boom] })
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    assert_equal boom, response.err
  end

  def test_make_request_a_nil_transport_result_becomes_a_response_error
    u = util_with(->(_c, _u, _f) { [nil, nil] })
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    refute_nil response.err
  end

  def test_make_request_wraps_a_normal_transport_response
    u = util_with(->(_c, _u, _f) {
      [{ "status" => 200, "statusText" => "OK", "headers" => {},
         "json" => -> { { "a" => 1 } }, "body" => "b" }, nil]
    })
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    assert_equal 200, response.status
  end

  def test_make_request_records_the_fetchdef_to_ctrl_explain
    u = util_with(->(_c, _u, _f) {
      [{ "status" => 200, "statusText" => "OK", "headers" => {},
         "json" => -> { nil }, "body" => "b" }, nil]
    })
    ctx = make_ctx(utility: u)
    ctx.ctrl.explain = {}
    ctx.spec = request_spec
    u.make_request.call(ctx)
    refute_nil ctx.ctrl.explain["fetchdef"]
  end

  def test_make_request_a_fetchdef_error_surfaces_as_a_response_error
    u = @client.get_utility
    u.make_fetch_def = ->(ctx) { [nil, PlaystationStoreApi2Error.new("fetchdef_boom", "boom")] }
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    refute_nil response.err
    assert_equal "fetchdef_boom", response.err.code
  end

  def test_make_request_short_circuits_a_feature_supplied_request
    ctx = make_ctx
    preset = resp(201)
    ctx.out["request"] = preset
    ctx.spec = request_spec
    out, err = @utility.make_request.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_fetch_def ===

  def test_make_fetch_def_guards_a_missing_spec
    ctx = make_ctx
    ctx.spec = nil
    _, err = @utility.make_fetch_def.call(ctx)
    assert_equal "fetchdef_no_spec", err.code
  end

  def test_make_fetch_def_serialises_a_hash_body_and_inits_a_missing_result
    ctx = make_ctx
    ctx.result = nil
    ctx.spec = spec_of(
      "method" => "POST", "base" => "http://h", "path" => "a",
      "body" => { "x" => 1 })
    fetchdef, err = @utility.make_fetch_def.call(ctx)
    assert_nil err
    assert_kind_of String, fetchdef["body"]
    assert_includes fetchdef["url"], "http://h"
    refute_nil ctx.result # result was lazily created
  end


  # === make_error + done ===

  def test_done_returns_resdata_on_success
    ctx = make_ctx
    ctx.result = PlaystationStoreApi2Result.new({ "ok" => true, "resdata" => 42 })
    assert_equal 42, @utility.done.call(ctx)
  end

  def test_done_raises_the_error_when_not_ok
    ctx = make_ctx
    ctx.result = PlaystationStoreApi2Result.new({ "ok" => false })
    assert_raises(PlaystationStoreApi2Error) { @utility.done.call(ctx) }
  end

  def test_done_cleans_ctrl_explain_on_success
    ctx = make_ctx
    ctx.ctrl.explain = { "result" => { "err" => "x" } }
    ctx.result = PlaystationStoreApi2Result.new({ "ok" => true, "resdata" => 7 })
    assert_equal 7, @utility.done.call(ctx)
  end

  def test_make_error_returns_resdata_when_throw_is_disabled
    ctx = make_ctx
    ctx.ctrl.throw_err = false
    ctx.result = PlaystationStoreApi2Result.new({ "ok" => false, "resdata" => "fallback" })
    assert_equal "fallback", @utility.make_error.call(ctx, nil)
  end

  def test_make_error_records_to_ctrl_explain
    ctx = make_ctx
    ctx.ctrl.throw_err = false
    ctx.ctrl.explain = {}
    ctx.result = PlaystationStoreApi2Result.new({ "ok" => false })
    @utility.make_error.call(ctx, nil)
    refute_nil ctx.ctrl.explain["err"]
  end

  def test_make_error_preserves_the_error_code
    ctx = make_ctx
    err = assert_raises(PlaystationStoreApi2Error) {
      @utility.make_error.call(ctx, ctx.make_error("rbac_denied", "denied"))
    }
    assert_equal "rbac_denied", err.code
  end


  # === feature ordering ===

  def test_feature_add_appends_in_call_order
    client = PlaystationStoreApi2SDK.test(nil, nil)
    utility = client.get_utility
    ctx = utility.make_context.call({
      "opname" => "load", "client" => client, "utility" => utility,
    }, nil)

    client.features = []
    a = PlaystationStoreApi2BaseFeature.new
    b = PlaystationStoreApi2BaseFeature.new
    utility.feature_add.call(ctx, a)
    utility.feature_add.call(ctx, b)
    assert_equal [a, b], client.features
  end

  def named_feature(name)
    f = PlaystationStoreApi2BaseFeature.new
    f.name = name
    f
  end

  # `_options` on an extend-feature instance positions it relative to an
  # already-added feature (mirrors the ts featureAdd).
  def test_feature_add_ordering_before_after_replace
    client = PlaystationStoreApi2SDK.test(nil, nil)
    utility = client.get_utility
    ctx = utility.make_context.call({
      "opname" => "load", "client" => client, "utility" => utility,
    }, nil)

    client.features = []
    names = -> { client.features.map(&:name) }

    utility.feature_add.call(ctx, named_feature("a"))
    utility.feature_add.call(ctx, named_feature("b"))
    assert_equal %w[a b], names.call

    before = named_feature("z1")
    before._options = { "__before__" => "b" }
    utility.feature_add.call(ctx, before)
    assert_equal %w[a z1 b], names.call

    after = named_feature("z2")
    after._options = { "__after__" => "a" }
    utility.feature_add.call(ctx, after)
    assert_equal %w[a z2 z1 b], names.call

    replace = named_feature("z3")
    replace._options = { "__replace__" => "z1" }
    utility.feature_add.call(ctx, replace)
    assert_equal %w[a z2 z3 b], names.call

    # An ordering option naming no existing feature falls back to append.
    miss = named_feature("z4")
    miss._options = { "__before__" => "missing" }
    utility.feature_add.call(ctx, miss)
    assert_equal %w[a z2 z3 b z4], names.call
  end


  # === prepare_auth ===

  # A cookie credential as prepare_auth writes it: `<scheme>=K` for the probe
  # key, with no scheme prefix and nothing else in the bag.
  COOKIE_PAIR = /\A[^=;]+=K\z/

  def auth_ctx(options, spec)
    ctx = PlaystationStoreApi2Context.new({
      "client" => OptClient.new(options),
      "utility" => @utility,
      "opname" => "load",
    }, nil)
    ctx.spec = spec
    ctx
  end

  def auth_bags
    PlaystationStoreApi2Spec.new({ "headers" => {}, "query" => {}, "step" => "s" })
  end

  # A cookie credential rides the header bag, because a cookie IS a header.
  def auth_bag(spec, where)
    "query" == where ? spec.query : spec.headers
  end

  # `basic: false` is explicit: an HTTP Basic API's generated config carries
  # `auth.basic: true`, and a client that merges it in takes a branch that
  # needs a secret as well. With none supplied that branch deliberately writes
  # nothing, which the probe would read as a public API.
  def auth_block(prefix)
    { "prefix" => prefix, "basic" => false }
  end

  # Run prepare_auth with both containers present and see which one the
  # generated utility writes to, and under what name. nil means this SDK
  # places no credential at all - a public API - which is a legitimate shape,
  # and the tests below assert exactly that instead. `pair` is the `<scheme>=`
  # lead-in of a COOKIE credential, which rides the header bag under the key
  # `cookie` instead of taking a header of its own.
  def auth_probe(options)
    ctx = auth_ctx(options, auth_bags)
    @utility.prepare_auth.call(ctx)
    ["headers", "query"].each do |where|
      bag = auth_bag(ctx.spec, where)
      bag.each do |name, value|
        pair = ""
        if "headers" == where && "cookie" == name && value.is_a?(String) &&
           COOKIE_PAIR.match?(value)
          pair = value[0..-2]
        end
        return { "where" => where, "name" => name, "value" => value, "pair" => pair }
      end
    end
    nil
  end

  def auth_credential
    auth_probe({ "apikey" => "K", "auth" => auth_block("Bearer") })
  end

  # Every credential this SDK could possibly place: both credentials and Basic
  # switched on, so whichever branch the API has, something lands unless the
  # API is public.
  def auth_any_credential
    auth_probe({ "apikey" => "K", "secret" => "S",
                 "auth" => { "prefix" => "Bearer", "basic" => true } })
  end

  def auth_placed(options, seed = nil)
    cred = auth_credential
    spec = auth_bags
    # Seed what prepare_auth would have written: cred["pair"] is the
    # "<scheme>=" lead-in for a cookie and "" for a header or query.
    auth_bag(spec, cred["where"])[cred["name"]] = cred["pair"] + seed if !cred.nil? && !seed.nil?
    ctx = auth_ctx(options, spec)
    @utility.prepare_auth.call(ctx)
    cred.nil? ? nil : auth_bag(ctx.spec, cred["where"])[cred["name"]]
  end

  def test_prepare_auth_guards_a_missing_spec
    ctx = auth_ctx({ "auth" => auth_block(""), "apikey" => "K" }, nil)
    _, err = @utility.prepare_auth.call(ctx)
    assert_equal "auth_no_spec", err.code
  end

  # Without this the cases below cannot fail for an SDK whose credential the
  # probe misses: every one of them takes the public-API path instead.
  def test_prepare_auth_probe_finds_the_credential_this_sdk_places
    assert_equal auth_credential.nil?, auth_any_credential.nil?
  end

  def test_prepare_auth_places_the_apikey_where_this_api_puts_it
    cred = auth_credential
    if cred.nil?
      # A public API places nothing, and that is the whole assertion.
      assert_nil auth_placed({ "apikey" => "K", "auth" => auth_block("Bearer") })
      return
    end
    assert_includes ["headers", "query"], cred["where"]
    if "" != cred["pair"]
      # A cookie credential is a `<scheme>=<key>` pair, and the scheme name
      # leaves no room for the option's prefix.
      assert_match COOKIE_PAIR, cred["value"]
      return
    end
    # A header credential is prefix-joined; a query credential is the raw
    # key, because a query parameter has nowhere to put a scheme name.
    assert_equal("query" == cred["where"] ? "K" : "Bearer K", cred["value"])
  end

  def test_prepare_auth_a_raw_apikey_goes_in_as_is
    cred = auth_credential
    expected = cred.nil? ? nil : cred["pair"] + "K"
    assert_equal expected, auth_placed({ "apikey" => "K", "auth" => auth_block("") })
  end

  def test_prepare_auth_an_empty_apikey_drops_the_credential
    assert_nil auth_placed({ "apikey" => "", "auth" => auth_block("Bearer") }, "stale")
  end

  def test_prepare_auth_a_public_api_drops_the_credential
    assert_nil auth_placed({ "apikey" => "K" }, "stale")
  end

  def test_prepare_auth_a_missing_apikey_option_drops_the_credential
    assert_nil auth_placed({ "auth" => auth_block("Bearer") }, "stale")
  end


  # === result helpers ===

  def test_result_headers_with_non_hash_headers_yields_an_empty_map
    ctx = make_ctx
    ctx.response = PlaystationStoreApi2Response.new({ "status" => 200 })
    ctx.result = PlaystationStoreApi2Result.new({})
    @utility.result_headers.call(ctx)
    assert_equal({}, ctx.result.headers)
  end

  def test_result_body_skips_parsing_when_the_body_is_absent
    ctx = make_ctx
    ctx.response = PlaystationStoreApi2Response.new({
      "status" => 200, "json" => -> { { "a" => 1 } }, "body" => nil,
    })
    ctx.result = PlaystationStoreApi2Result.new({})
    @utility.result_body.call(ctx)
    assert_nil ctx.result.body
  end
end

<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK pipeline test
//
// Direct unit tests for the operation-pipeline utilities. The generated
// entity tests exercise the happy path; these drive the error and edge
// branches (missing spec/response/result, 4xx handling, transport
// failures, feature ordering, auth header shaping) that a normal
// success-path op never reaches. Mirrors tm/ts/test/pipeline.test.ts,
// adapted to the PHP utility APIs (tuple `[value, err]` returns instead of
// returned Error values).
//
// Inapplicable TS cases (noted rather than ported):
// - "a body-parse exception is captured on result.err": the PHP
//   result_body utility calls the response json closure without a guard,
//   so a throwing body surfaces as an exception, not on result->err.
// - makeFetchDef "inits a missing result": covered, but note the PHP
//   make_fetch_def builds the URL through make_url (spec parts/path), not
//   inline.

require_once __DIR__ . '/../projectname_sdk.php';
require_once __DIR__ . '/Runner.php';

use PHPUnit\Framework\TestCase;

// Fake client exposing exactly the options map a test wants.
class PlClient
{
    public string $mode = 'test';
    public array $features = [];
    public array $options;

    public function __construct(array $options = [])
    {
        $this->options = $options;
    }

    public function options_map(): array
    {
        return $this->options;
    }
}

// Fake entity for the make_result list wrap: make() yields an item that
// records the data it was given.
class PlEntityItem
{
    public array $data = [];

    public function data_set(array $d): void
    {
        $this->data = $d;
    }
}

class PlEntity
{
    public array $made = [];

    public function get_name(): string
    {
        return 'x';
    }

    public function make(): PlEntityItem
    {
        $item = new PlEntityItem();
        $this->made[] = $item;
        return $item;
    }
}

class PipelineTest extends TestCase
{
    private static function utility(): PlaystationStoreApi2Utility
    {
        return new PlaystationStoreApi2Utility();
    }

    // Transport-shaped response array with a re-readable body.
    private static function resp(int $status, mixed $data = null, array $headers = []): array
    {
        $h = [];
        foreach ($headers as $k => $v) {
            $h[strtolower((string)$k)] = $v;
        }
        return [
            'status' => $status,
            'statusText' => $status < 400 ? 'OK' : 'ERR',
            'body' => 'body',
            'json' => function () use ($data) { return $data; },
            'headers' => $h,
        ];
    }

    private static function ctx(array $over = []): PlaystationStoreApi2Context
    {
        $utility = $over['utility'] ?? self::utility();
        $client = $over['client'] ?? new PlClient(['base' => 'http://h']);
        $ctx = new PlaystationStoreApi2Context([
            'client' => $client,
            'utility' => $utility,
        ], null);
        $ctx->op = new PlaystationStoreApi2Operation(['name' => 'load', 'entity' => 'x']);
        foreach ($over as $k => $v) {
            if ($k === 'utility' || $k === 'client') {
                continue;
            }
            $ctx->$k = $v;
        }
        return $ctx;
    }

    private static function code(mixed $err): string
    {
        return ($err instanceof PlaystationStoreApi2Error) ? $err->sdk_code : '';
    }


    // --- feature order (feature #2) -----------------------------------------
    // options['feature'] accepts an ordered LIST (developer add-order) or a map
    // (defaults test-first); make_options records the resolved order in
    // __derived__.featureorder.

    private static function resolve_order(mixed $feature): string
    {
        $utility = self::utility();
        $client = new PlClient([]);
        $ctx = new PlaystationStoreApi2Context([
            'client' => $client,
            'utility' => $utility,
        ], null);
        $ctx->options = ['feature' => $feature];
        $ctx->config = ['options' => []];
        $opts = ($utility->make_options)($ctx);
        $order = $opts['__derived__']['featureorder'] ?? [];
        return implode(',', $order);
    }

    public function test_feature_order_map_is_test_first(): void
    {
        $this->assertSame('test,metrics', self::resolve_order([
            'metrics' => ['active' => true],
            'test' => ['active' => true],
        ]));
    }

    public function test_feature_order_list_preserves_order(): void
    {
        $this->assertSame('metrics,test', self::resolve_order([
            ['name' => 'metrics', 'active' => true],
            ['name' => 'test', 'active' => true],
        ]));
    }

    // Station special case, mirroring test's: its transport wrap must sit
    // immediately outside the base transport, so map-form activation hoists
    // it to just after test - or first, when no test entry exists.
    public function test_feature_order_map_hoists_station_after_test(): void
    {
        $this->assertSame('test,station,metrics', self::resolve_order([
            'metrics' => ['active' => true],
            'station' => ['active' => true],
            'test' => ['active' => true],
        ]));
    }

    public function test_feature_order_map_hoists_station_first_without_test(): void
    {
        $this->assertSame('station,metrics', self::resolve_order([
            'metrics' => ['active' => true],
            'station' => ['active' => true],
        ]));
    }

    public function test_feature_order_no_test_deterministic(): void
    {
        $this->assertSame('cache,retry', self::resolve_order([
            'retry' => ['active' => true],
            'cache' => ['active' => true],
        ]));
    }


    // --- make_point + make_spec ---------------------------------------------

    public function test_make_point_rejects_a_disallowed_operation(): void
    {
        $ctx = self::ctx(['options' => ['allow' => ['op' => 'load']]]);
        $ctx->op = new PlaystationStoreApi2Operation(['name' => 'nope', 'entity' => 'x']);
        [$point, $err] = PlaystationStoreApi2MakePoint::call($ctx);
        $this->assertNull($point);
        $this->assertSame('point_op_allow', self::code($err));
    }

    public function test_make_point_rejects_an_operation_with_no_endpoints(): void
    {
        $ctx = self::ctx(['options' => ['allow' => ['op' => 'load,list,create,update,remove']]]);
        $ctx->op = new PlaystationStoreApi2Operation(['name' => 'load', 'entity' => 'x', 'points' => []]);
        [$point, $err] = PlaystationStoreApi2MakePoint::call($ctx);
        $this->assertNull($point);
        $this->assertSame('point_no_points', self::code($err));
    }

    public function test_make_point_returns_the_single_point(): void
    {
        $point = ['method' => 'GET', 'parts' => ['a']];
        $ctx = self::ctx(['options' => ['allow' => ['op' => 'load,list,create,update,remove']]]);
        $ctx->op = new PlaystationStoreApi2Operation(['name' => 'load', 'entity' => 'x', 'points' => [$point]]);
        [$got, $err] = PlaystationStoreApi2MakePoint::call($ctx);
        $this->assertNull($err);
        $this->assertSame($point, $got);
    }

    public function test_make_point_short_circuits_a_feature_supplied_point(): void
    {
        $preset = ['method' => 'GET'];
        $ctx = self::ctx();
        $ctx->out['point'] = $preset;
        [$got, $err] = PlaystationStoreApi2MakePoint::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }

    public function test_make_point_surfaces_a_feature_supplied_error(): void
    {
        // The rbac feature places its denial in ctx.out.point (PrePoint);
        // make_point must surface it as the pipeline error before any
        // endpoint resolution or network activity.
        $ctx = self::ctx();
        $denial = $ctx->make_error('rbac_denied', 'Permission "admin" required for operation "load"');
        $ctx->out['point'] = $denial;
        [$got, $err] = PlaystationStoreApi2MakePoint::call($ctx);
        $this->assertNull($got);
        $this->assertSame($denial, $err);
        $this->assertSame('rbac_denied', self::code($err));
    }

    public function test_make_spec_short_circuits_a_feature_supplied_spec(): void
    {
        $preset = new PlaystationStoreApi2Spec(['method' => 'GET']);
        $ctx = self::ctx();
        $ctx->out['spec'] = $preset;
        [$got, $err] = PlaystationStoreApi2MakeSpec::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }


    // --- make_response ---------------------------------------------------------

    public function test_make_response_guards_missing_spec_response_result(): void
    {
        $ctx = self::ctx([
            'spec' => null,
            'response' => new PlaystationStoreApi2Response([]),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        [, $err] = PlaystationStoreApi2MakeResponse::call($ctx);
        $this->assertSame('response_no_spec', self::code($err));

        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec([]),
            'response' => null,
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        [, $err] = PlaystationStoreApi2MakeResponse::call($ctx);
        $this->assertSame('response_no_response', self::code($err));

        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec([]),
            'response' => new PlaystationStoreApi2Response([]),
            'result' => null,
        ]);
        [, $err] = PlaystationStoreApi2MakeResponse::call($ctx);
        $this->assertSame('response_no_result', self::code($err));
    }

    public function test_make_response_4xx_sets_result_err_and_copies_headers(): void
    {
        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec(['step' => 's']),
            'response' => new PlaystationStoreApi2Response(self::resp(404, null, ['x-a' => '1'])),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        [, $err] = PlaystationStoreApi2MakeResponse::call($ctx);
        $this->assertNull($err);
        $this->assertNotNull($ctx->result->err);
        $this->assertSame(404, $ctx->result->status);
        $this->assertSame('1', $ctx->result->headers['x-a']);
        $this->assertFalse($ctx->result->ok);
    }

    public function test_make_response_2xx_parses_the_body_and_marks_ok(): void
    {
        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec(['step' => 's']),
            'response' => new PlaystationStoreApi2Response(self::resp(200, ['v' => 1])),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        [, $err] = PlaystationStoreApi2MakeResponse::call($ctx);
        $this->assertNull($err);
        $this->assertTrue($ctx->result->ok);
        $this->assertSame(['v' => 1], $ctx->result->body);
    }

    public function test_make_response_records_to_ctrl_explain_when_explain_is_on(): void
    {
        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec(['step' => 's']),
            'response' => new PlaystationStoreApi2Response(self::resp(200, ['v' => 2])),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        $ctx->ctrl->explain = ['on' => true];
        PlaystationStoreApi2MakeResponse::call($ctx);
        $this->assertNotNull($ctx->ctrl->explain['result'] ?? null);
    }

    public function test_make_response_short_circuits_a_feature_supplied_response(): void
    {
        $preset = new PlaystationStoreApi2Response(self::resp(299));
        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec([]),
            'response' => new PlaystationStoreApi2Response([]),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        $ctx->out['response'] = $preset;
        [$got, $err] = PlaystationStoreApi2MakeResponse::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }


    // --- make_result -----------------------------------------------------------

    public function test_make_result_guards_missing_spec_and_result(): void
    {
        $ctx = self::ctx(['spec' => null, 'result' => new PlaystationStoreApi2Result([])]);
        [, $err] = PlaystationStoreApi2MakeResult::call($ctx);
        $this->assertSame('result_no_spec', self::code($err));

        $ctx = self::ctx(['spec' => new PlaystationStoreApi2Spec([]), 'result' => null]);
        [, $err] = PlaystationStoreApi2MakeResult::call($ctx);
        $this->assertSame('result_no_result', self::code($err));
    }

    public function test_make_result_list_op_wraps_resdata_into_entity_instances(): void
    {
        $entity = new PlEntity();
        $ctx = self::ctx([
            'entity' => $entity,
            'spec' => new PlaystationStoreApi2Spec(['step' => 's']),
            'result' => new PlaystationStoreApi2Result(['ok' => true, 'resdata' => [['a' => 1], ['a' => 2]]]),
        ]);
        $ctx->op = new PlaystationStoreApi2Operation(['name' => 'list', 'entity' => 'x']);
        [$result, $err] = PlaystationStoreApi2MakeResult::call($ctx);
        $this->assertNull($err);
        $this->assertCount(2, $result->resdata);
        $this->assertCount(2, $entity->made);
        $this->assertSame(['a' => 1], $result->resdata[0]->data);
    }

    public function test_make_result_empty_list_yields_empty_resdata(): void
    {
        $entity = new PlEntity();
        $ctx = self::ctx([
            'entity' => $entity,
            'spec' => new PlaystationStoreApi2Spec(['step' => 's']),
            'result' => new PlaystationStoreApi2Result(['ok' => true, 'resdata' => []]),
        ]);
        $ctx->op = new PlaystationStoreApi2Operation(['name' => 'list', 'entity' => 'x']);
        [$result, $err] = PlaystationStoreApi2MakeResult::call($ctx);
        $this->assertNull($err);
        $this->assertSame([], $result->resdata);
        $this->assertCount(0, $entity->made);
    }

    public function test_make_result_short_circuits_on_a_preset_result(): void
    {
        $preset = new PlaystationStoreApi2Result(['ok' => true]);
        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec([]),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        $ctx->out['result'] = $preset;
        [$got, $err] = PlaystationStoreApi2MakeResult::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }


    // --- make_request -----------------------------------------------------------

    public function test_make_request_guards_a_missing_spec(): void
    {
        $ctx = self::ctx(['spec' => null]);
        [, $err] = PlaystationStoreApi2MakeRequest::call($ctx);
        $this->assertSame('request_no_spec', self::code($err));
    }

    public function test_make_request_a_transport_error_is_carried_on_the_response(): void
    {
        $utility = self::utility();
        $boom = new PlaystationStoreApi2Error('boom', 'boom');
        $utility->fetcher = function (PlaystationStoreApi2Context $_c, string $_u, array $_f) use ($boom): array {
            return [null, $boom];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new PlaystationStoreApi2Spec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        [$response, $err] = PlaystationStoreApi2MakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertSame($boom, $response->err);
    }

    public function test_make_request_a_null_transport_result_becomes_a_response_error(): void
    {
        $utility = self::utility();
        $utility->fetcher = function (PlaystationStoreApi2Context $_c, string $_u, array $_f): array {
            return [null, null];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new PlaystationStoreApi2Spec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        [$response, $err] = PlaystationStoreApi2MakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertNotNull($response->err);
        $this->assertSame('request_no_response', self::code($response->err));
    }

    public function test_make_request_a_normal_transport_response_is_wrapped(): void
    {
        $utility = self::utility();
        $utility->fetcher = function (PlaystationStoreApi2Context $_c, string $_u, array $_f): array {
            return [PipelineTest::resp_public(200, ['a' => 1]), null];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new PlaystationStoreApi2Spec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        [$response, $err] = PlaystationStoreApi2MakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertInstanceOf(PlaystationStoreApi2Response::class, $response);
        $this->assertSame(200, $response->status);
    }

    public function test_make_request_records_the_fetchdef_to_ctrl_explain(): void
    {
        $utility = self::utility();
        $utility->fetcher = function (PlaystationStoreApi2Context $_c, string $_u, array $_f): array {
            return [PipelineTest::resp_public(200, []), null];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new PlaystationStoreApi2Spec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        $ctx->ctrl->explain = ['on' => true];
        PlaystationStoreApi2MakeRequest::call($ctx);
        $this->assertNotNull($ctx->ctrl->explain['fetchdef'] ?? null);
    }

    public function test_make_request_a_fetchdef_error_surfaces_as_a_response_error(): void
    {
        $utility = self::utility();
        $utility->make_fetch_def = function (PlaystationStoreApi2Context $c): array {
            return [null, $c->make_error('fetchdef_boom', 'boom')];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new PlaystationStoreApi2Spec(['step' => 's', 'method' => 'GET']),
        ]);
        [$response, $err] = PlaystationStoreApi2MakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertNotNull($response->err);
        $this->assertSame('fetchdef_boom', self::code($response->err));
        $this->assertSame('postrequest', $ctx->spec->step);
    }

    public function test_make_request_short_circuits_a_feature_supplied_request(): void
    {
        $preset = new PlaystationStoreApi2Response(self::resp(201));
        $ctx = self::ctx(['spec' => new PlaystationStoreApi2Spec([])]);
        $ctx->out['request'] = $preset;
        [$got, $err] = PlaystationStoreApi2MakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }

    // Public wrapper so closures above can build responses.
    public static function resp_public(int $status, mixed $data = null, array $headers = []): array
    {
        return self::resp($status, $data, $headers);
    }


    // --- make_fetch_def ----------------------------------------------------------

    public function test_make_fetch_def_guards_a_missing_spec(): void
    {
        $ctx = self::ctx(['spec' => null]);
        [, $err] = PlaystationStoreApi2MakeFetchDef::call($ctx);
        $this->assertSame('fetchdef_no_spec', self::code($err));
    }

    public function test_make_fetch_def_serialises_body_and_inits_missing_result(): void
    {
        $ctx = self::ctx([
            'spec' => new PlaystationStoreApi2Spec([
                'step' => 's', 'method' => 'POST', 'base' => 'http://h',
                'prefix' => '', 'suffix' => '', 'path' => 'a', 'body' => ['x' => 1],
            ]),
            'result' => null,
        ]);
        [$fetchdef, $err] = PlaystationStoreApi2MakeFetchDef::call($ctx);
        $this->assertNull($err);
        $this->assertIsString($fetchdef['body']);
        $this->assertStringContainsString('http://h', $fetchdef['url']);
        $this->assertNotNull($ctx->result); // result was lazily created
    }


    // --- make_error + done ---------------------------------------------------------

    public function test_done_returns_resdata_on_success(): void
    {
        $ctx = self::ctx(['result' => new PlaystationStoreApi2Result(['ok' => true, 'resdata' => 42])]);
        $this->assertSame(42, PlaystationStoreApi2Done::call($ctx));
    }

    public function test_done_raises_the_error_when_not_ok(): void
    {
        $ctx = self::ctx(['result' => new PlaystationStoreApi2Result(['ok' => false])]);
        $this->expectException(PlaystationStoreApi2Error::class);
        PlaystationStoreApi2Done::call($ctx);
    }

    public function test_make_error_returns_resdata_when_ctrl_throw_is_false(): void
    {
        $ctx = self::ctx(['result' => new PlaystationStoreApi2Result(['ok' => false, 'resdata' => 'fallback'])]);
        $ctx->ctrl->throw_err = false;
        $this->assertSame('fallback', PlaystationStoreApi2MakeError::call($ctx, null));
    }

    public function test_make_error_records_to_ctrl_explain(): void
    {
        $ctx = self::ctx(['result' => new PlaystationStoreApi2Result(['ok' => false])]);
        $ctx->ctrl->throw_err = false;
        $ctx->ctrl->explain = ['on' => true];
        PlaystationStoreApi2MakeError::call($ctx, null);
        $this->assertNotNull($ctx->ctrl->explain['err'] ?? null);
    }


    // --- feature_add ordering ---------------------------------------------------

    public function test_feature_add_appends_in_call_order(): void
    {
        $client = new PlClient([]);
        $ctx = self::ctx(['client' => $client]);
        $a = new PlaystationStoreApi2BaseFeature();
        $b = new PlaystationStoreApi2BaseFeature();
        PlaystationStoreApi2FeatureAdd::call($ctx, $a);
        PlaystationStoreApi2FeatureAdd::call($ctx, $b);
        $this->assertSame([$a, $b], $client->features);
    }

    private static function named_feature(string $name): PlaystationStoreApi2BaseFeature
    {
        $f = new PlaystationStoreApi2BaseFeature();
        $f->name = $name;
        return $f;
    }

    public function test_feature_add_ordering_before_after_replace(): void
    {
        // `_options` on an extend-feature instance positions it relative to
        // an already-added feature (mirrors the TS featureAdd).
        $client = new PlClient([]);
        $ctx = self::ctx(['client' => $client]);
        $names = fn() => array_map(fn($f) => $f->name, $client->features);

        PlaystationStoreApi2FeatureAdd::call($ctx, self::named_feature('a'));
        PlaystationStoreApi2FeatureAdd::call($ctx, self::named_feature('b'));
        $this->assertSame(['a', 'b'], $names());

        $before = self::named_feature('z1');
        $before->_options = ['__before__' => 'b'];
        PlaystationStoreApi2FeatureAdd::call($ctx, $before);
        $this->assertSame(['a', 'z1', 'b'], $names());

        $after = self::named_feature('z2');
        $after->_options = ['__after__' => 'a'];
        PlaystationStoreApi2FeatureAdd::call($ctx, $after);
        $this->assertSame(['a', 'z2', 'z1', 'b'], $names());

        $replace = self::named_feature('z3');
        $replace->_options = ['__replace__' => 'z1'];
        PlaystationStoreApi2FeatureAdd::call($ctx, $replace);
        $this->assertSame(['a', 'z2', 'z3', 'b'], $names());

        // An ordering option naming no existing feature falls back to append.
        $miss = self::named_feature('z4');
        $miss->_options = ['__before__' => 'missing'];
        PlaystationStoreApi2FeatureAdd::call($ctx, $miss);
        $this->assertSame(['a', 'z2', 'z3', 'b', 'z4'], $names());
    }


    // --- prepare_auth ------------------------------------------------------------

    /**
     * A cookie credential as prepare_auth writes it: `<scheme>=K` for the
     * probe key, with no scheme prefix and nothing else in the bag.
     */
    private const COOKIE_PAIR = '/^[^=;]+=K$/';

    private static function auth_ctx(array $options, ?PlaystationStoreApi2Spec $spec): PlaystationStoreApi2Context
    {
        $client = new PlClient($options);
        return self::ctx([
            'client' => $client,
            'spec' => $spec,
        ]);
    }

    private static function auth_bags(): PlaystationStoreApi2Spec
    {
        return new PlaystationStoreApi2Spec(['headers' => [], 'query' => []]);
    }

    /**
     * `basic: false` is explicit: an HTTP Basic API's generated config carries
     * `auth.basic: true`, and a client that merges it in takes a branch that
     * needs a secret as well. With none supplied that branch deliberately
     * writes nothing, which the probe would read as a public API.
     */
    private static function auth_block(string $prefix): array
    {
        return ['prefix' => $prefix, 'basic' => false];
    }

    /**
     * Run prepare_auth with both containers present and see which one the
     * generated utility writes to, and under what name. Null means this SDK
     * places no credential at all - a public API - which is a legitimate
     * shape, and the tests below assert exactly that instead. `pair` is the
     * `<scheme>=` lead-in of a COOKIE credential, which rides the header bag
     * under the key `cookie` instead of taking a header of its own.
     *
     * @return array{where:string,name:string,value:mixed,pair:string}|null
     */
    private static function auth_probe(array $options): ?array
    {
        $ctx = self::auth_ctx($options, self::auth_bags());
        PlaystationStoreApi2PrepareAuth::call($ctx);
        foreach (['headers', 'query'] as $where) {
            // A cookie credential rides the header bag, because a cookie IS
            // a header.
            $bag = 'query' === $where ? $ctx->spec->query : $ctx->spec->headers;
            foreach ($bag as $name => $value) {
                $pair = '';
                if ('headers' === $where && 'cookie' === $name && is_string($value)
                    && 1 === preg_match(self::COOKIE_PAIR, $value)) {
                    $pair = substr($value, 0, -1);
                }
                return ['where' => $where, 'name' => $name, 'value' => $value, 'pair' => $pair];
            }
        }
        return null;
    }

    /** @return array{where:string,name:string,value:mixed,pair:string}|null */
    private static function auth_credential(): ?array
    {
        return self::auth_probe(
            ['apikey' => 'K', 'auth' => self::auth_block('Bearer')]);
    }

    /**
     * Every credential this SDK could possibly place: both credentials and
     * Basic switched on, so whichever branch the API has, something lands
     * unless the API is public.
     *
     * @return array{where:string,name:string,value:mixed,pair:string}|null
     */
    private static function auth_any_credential(): ?array
    {
        return self::auth_probe([
            'apikey' => 'K', 'secret' => 'S',
            'auth' => ['prefix' => 'Bearer', 'basic' => true],
        ]);
    }

    /** @return array{0:mixed,1:bool} the value left in the credential slot, and whether it is there */
    private static function auth_placed(array $options, $seed = null): array
    {
        $cred = self::auth_credential();
        $spec = self::auth_bags();
        if (null !== $cred && null !== $seed) {
            // Seed what prepare_auth would have written: pair is the
            // "<scheme>=" lead-in for a cookie and '' for a header or query,
            // so a clearing case removes a credential this SDK owns rather
            // than a cookie the caller put there.
            $seeded = $cred['pair'] . $seed;
            if ('query' === $cred['where']) {
                $spec->query[$cred['name']] = $seeded;
            } else {
                $spec->headers[$cred['name']] = $seeded;
            }
        }
        $ctx = self::auth_ctx($options, $spec);
        PlaystationStoreApi2PrepareAuth::call($ctx);
        if (null === $cred) {
            return [null, false];
        }
        $bag = 'query' === $cred['where'] ? $ctx->spec->query : $ctx->spec->headers;
        return [$bag[$cred['name']] ?? null, array_key_exists($cred['name'], $bag)];
    }

    public function test_prepare_auth_guards_a_missing_spec(): void
    {
        $ctx = self::auth_ctx(['auth' => self::auth_block(''), 'apikey' => 'K'], null);
        [, $err] = PlaystationStoreApi2PrepareAuth::call($ctx);
        $this->assertSame('auth_no_spec', self::code($err));
    }

    /**
     * Without this the cases below cannot fail for an SDK whose credential the
     * probe misses: every one of them takes the public-API path instead.
     */
    public function test_prepare_auth_probe_finds_the_credential_this_sdk_places(): void
    {
        $this->assertSame(
            null === self::auth_credential(), null === self::auth_any_credential());
    }

    public function test_prepare_auth_places_the_apikey_where_this_api_puts_it(): void
    {
        $cred = self::auth_credential();
        if (null === $cred) {
            // A public API places nothing, and that is the whole assertion.
            [, $has] = self::auth_placed(['apikey' => 'K', 'auth' => self::auth_block('Bearer')]);
            $this->assertFalse($has);
            return;
        }
        $this->assertContains($cred['where'], ['headers', 'query']);
        if ('' !== $cred['pair']) {
            // A cookie credential is a `<scheme>=<key>` pair, and the scheme
            // name leaves no room for the option's prefix.
            $this->assertMatchesRegularExpression(self::COOKIE_PAIR, $cred['value']);
            return;
        }
        // A header credential is prefix-joined; a query credential is the raw
        // key, because a query parameter has nowhere to put a scheme name.
        $this->assertSame('query' === $cred['where'] ? 'K' : 'Bearer K', $cred['value']);
    }

    public function test_prepare_auth_a_raw_apikey_goes_in_as_is(): void
    {
        [$value, $has] = self::auth_placed(['apikey' => 'K', 'auth' => self::auth_block('')]);
        $cred = self::auth_credential();
        if (null === $cred) {
            $this->assertFalse($has);
            return;
        }
        $this->assertSame($cred['pair'] . 'K', $value);
    }

    public function test_prepare_auth_an_empty_apikey_drops_the_credential(): void
    {
        [, $has] = self::auth_placed(
            ['apikey' => '', 'auth' => self::auth_block('Bearer')], 'stale');
        $this->assertFalse($has);
    }

    public function test_prepare_auth_a_public_api_drops_the_credential(): void
    {
        [, $has] = self::auth_placed(['apikey' => 'K'], 'stale');
        $this->assertFalse($has);
    }

    public function test_prepare_auth_a_missing_apikey_option_drops_the_credential(): void
    {
        [, $has] = self::auth_placed(['auth' => self::auth_block('Bearer')], 'stale');
        $this->assertFalse($has);
    }


    // --- result helpers ------------------------------------------------------------

    public function test_result_headers_with_non_array_headers_yields_empty_map(): void
    {
        $ctx = self::ctx([
            'response' => new PlaystationStoreApi2Response(['headers' => null]),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        PlaystationStoreApi2ResultHeaders::call($ctx);
        $this->assertSame([], $ctx->result->headers);
    }

    public function test_result_body_skips_parsing_when_the_body_is_absent(): void
    {
        $ctx = self::ctx([
            'response' => new PlaystationStoreApi2Response([
                'json' => function () { return ['a' => 1]; },
                'body' => null,
            ]),
            'result' => new PlaystationStoreApi2Result([]),
        ]);
        PlaystationStoreApi2ResultBody::call($ctx);
        $this->assertNull($ctx->result->body);
    }
}

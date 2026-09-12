<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK primary utility test
//
// Corpus sections run through the vendored omni runner, via the resolver
// in test/Omni.php (struct-runner shape over native Voxgig\Omni). The
// inline corpus engine this file used to carry is retired: omni resolves
// arguments, applies the null rules, and enforces out/err/match - the
// subjects below only adapt each utility's calling convention.
//
// Three conventions to know when adding a section:
//
// - Utilities that answer as a (value, err) TUPLE go through
//   PlaystationStoreApi2Omni::unwrap, which throws the err so omni can match it
//   against `err:` expectations. Utilities that answer bare values (or
//   throw) are returned straight.
//
// - Contexts stay MAPS across the runner (Omni.php decision 2): a subject
//   builds the typed context with PlaystationStoreApi2Omni::ctx_from_map, runs the
//   utility, and writes the observable state back with
//   PlaystationStoreApi2Omni::sync_ctx BEFORE throwing any error - that map is
//   where a `match: {ctx: ...}` assertion reads.
//
// - `runsection` fails loudly when a section would run ZERO cases; a
//   deliberately-empty (pending) section is named in PENDING.

require_once __DIR__ . '/../projectname_sdk.php';
require_once __DIR__ . '/Runner.php';
require_once __DIR__ . '/Omni.php';

use PHPUnit\Framework\TestCase;

class PrimaryUtilityTest extends TestCase
{
    // Resolved against test/Omni.php's own directory, so the suite works
    // from any working directory.
    private const TEST_JSON_FILE = '../../.sdk/test/test.json';

    // Sections deliberately left empty in the shared corpus
    // (.sdk/test/primary/<name>.aon carries a PENDING header). Everything
    // else MUST contribute cases.
    private const PENDING = [
        'fetcher', 'makeFetchDef', 'makeResult',
        'featureAdd', 'featureHook', 'featureInit',
    ];

    private static ?array $run = null;

    /** The 'primary' runpack, built once for the whole class. */
    private static function runpack(): array
    {
        if (self::$run === null) {
            $runner = PlaystationStoreApi2Omni::makeRunner(
                self::TEST_JSON_FILE, PlaystationStoreApi2SDK::test(null, null));
            self::$run = $runner('primary');
        }
        return self::$run;
    }

    /** The live SDK behind the runpack's provider client. */
    private static function client(): PlaystationStoreApi2SDK
    {
        return self::runpack()['client']['sdk'];
    }

    /**
     * Run one corpus section, failing loudly when it would run ZERO
     * cases. A renamed section or a fixture that compiled to an empty
     * `set` used to pass silently, which defeats the point of a shared
     * oracle. EVERY corpus-backed test goes through here (mirrors ts/py).
     */
    private function runsection(string $name, callable $subject): void
    {
        $R = self::runpack();
        $spec = $R['spec'];

        $section = is_array($spec) ? ($spec[$name] ?? null) : null;
        $this->assertIsArray($section,
            "test corpus section '{$name}' missing - check the name against .sdk/test/primary/");

        $basic = $section['basic'] ?? null;
        $this->assertTrue(is_array($basic) && is_array($basic['set'] ?? null),
            "test corpus section '{$name}' has no basic.set list");

        if (0 === count($basic['set']) && !in_array($name, self::PENDING, true)) {
            $this->fail(
                "test corpus section '{$name}' is EMPTY - zero cases would run; " .
                "add cases, or mark the fixture PENDING in .sdk/test/primary/");
        }

        $R['runset']($basic, $subject);
        $this->assertTrue(true, "corpus section '{$name}' completed");
    }

    private static function make_test_ctx(
        PlaystationStoreApi2SDK $client,
        PlaystationStoreApi2Utility $utility,
        ?array $overrides = null
    ): PlaystationStoreApi2Context {
        $ctxmap = [
            'opname' => 'load',
            'client' => $client,
            'utility' => $utility,
        ];
        if ($overrides !== null) {
            foreach ($overrides as $k => $v) {
                $ctxmap[$k] = $v;
            }
        }
        return ($utility->make_context)($ctxmap, $client->get_root_ctx());
    }

    private static function make_test_full_ctx(
        PlaystationStoreApi2SDK $client,
        PlaystationStoreApi2Utility $utility
    ): PlaystationStoreApi2Context {
        $ctx = self::make_test_ctx($client, $utility);
        $ctx->point = [
            'parts' => ['items', '{id}'],
            'args' => ['params' => [['name' => 'id', 'reqd' => true]]],
            'params' => ['id'],
            'alias' => [],
            'select' => [],
            'active' => true,
            'transform' => [],
        ];
        $ctx->match = ['id' => 'item01'];
        $ctx->reqmatch = ['id' => 'item01'];
        return $ctx;
    }


    // === Test: exists ===

    public function test_exists(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();

        $this->assertNotNull($utility->clean, 'clean should not be null');
        $this->assertNotNull($utility->done, 'done should not be null');
        $this->assertNotNull($utility->make_error, 'make_error should not be null');
        $this->assertNotNull($utility->feature_add, 'feature_add should not be null');
        $this->assertNotNull($utility->feature_hook, 'feature_hook should not be null');
        $this->assertNotNull($utility->feature_init, 'feature_init should not be null');
        $this->assertNotNull($utility->fetcher, 'fetcher should not be null');
        $this->assertNotNull($utility->make_fetch_def, 'make_fetch_def should not be null');
        $this->assertNotNull($utility->make_context, 'make_context should not be null');
        $this->assertNotNull($utility->make_options, 'make_options should not be null');
        $this->assertNotNull($utility->make_request, 'make_request should not be null');
        $this->assertNotNull($utility->make_response, 'make_response should not be null');
        $this->assertNotNull($utility->make_result, 'make_result should not be null');
        $this->assertNotNull($utility->make_point, 'make_point should not be null');
        $this->assertNotNull($utility->make_spec, 'make_spec should not be null');
        $this->assertNotNull($utility->make_url, 'make_url should not be null');
        $this->assertNotNull($utility->param, 'param should not be null');
        $this->assertNotNull($utility->prepare_auth, 'prepare_auth should not be null');
        $this->assertNotNull($utility->prepare_body, 'prepare_body should not be null');
        $this->assertNotNull($utility->prepare_headers, 'prepare_headers should not be null');
        $this->assertNotNull($utility->prepare_method, 'prepare_method should not be null');
        $this->assertNotNull($utility->prepare_params, 'prepare_params should not be null');
        $this->assertNotNull($utility->prepare_path, 'prepare_path should not be null');
        $this->assertNotNull($utility->prepare_query, 'prepare_query should not be null');
        $this->assertNotNull($utility->result_basic, 'result_basic should not be null');
        $this->assertNotNull($utility->result_body, 'result_body should not be null');
        $this->assertNotNull($utility->result_headers, 'result_headers should not be null');
        $this->assertNotNull($utility->transform_request, 'transform_request should not be null');
        $this->assertNotNull($utility->transform_response, 'transform_response should not be null');
    }


    // === Test: clean-basic ===

    public function test_clean_basic(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_ctx($client, $utility);
        $val = ['key' => 'secret123', 'name' => 'test'];
        $cleaned = ($utility->clean)($ctx, $val);
        $this->assertNotNull($cleaned, 'cleaned should not be null');
    }


    // === Test: done-basic ===

    public function test_done_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('done', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            // done returns the bare result data, or raises on error - which
            // omni matches against the entry's `err`.
            return ($utility->done)($ctx);
        });
    }


    // === Test: makeError-basic ===

    public function test_make_error_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('makeError', function ($ctxmap = null, $errmap = null) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map(
                is_array($ctxmap) ? $ctxmap : [], $client, $utility);
            $err = PlaystationStoreApi2Omni::err_from_map(is_array($errmap) ? $errmap : null);
            // make_error RAISES the constructed exception on the default
            // (throw) path; omni matches it against the entry's err. On the
            // no-throw path it returns the bare result data.
            return ($utility->make_error)($ctx, $err);
        });
    }


    // === Test: makeError-no-throw ===

    public function test_make_error_no_throw(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->ctrl->throw_err = false;
        $ctx->result = new PlaystationStoreApi2Result([
            'ok' => false,
            'resdata' => ['id' => 'safe01'],
        ]);

        // throw_err === false: make_error returns the bare result data instead
        // of raising (the result-object / no-throw escape hatch).
        $out = ($utility->make_error)($ctx, $ctx->make_error('test_code', 'test message'));
        $this->assertIsArray($out);
        $this->assertEquals('safe01', $out['id']);
    }


    // === Test: featureAdd-basic ===

    public function test_feature_add_basic(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_ctx($client, $utility);
        $start_len = count($client->features);

        $feature = new PlaystationStoreApi2BaseFeature();
        ($utility->feature_add)($ctx, $feature);

        $this->assertEquals($start_len + 1, count($client->features));
    }


    // === Test: featureHook-basic ===

    public function test_feature_hook_basic(): void
    {
        $hook_client = PlaystationStoreApi2SDK::test(null, null);
        $hook_utility = $hook_client->get_utility();
        $ctx = self::make_test_ctx($hook_client, $hook_utility);

        $called = false;
        $hook_feature = new class extends PlaystationStoreApi2BaseFeature {
            public $hook_fn = null;
            public function TestHook(PlaystationStoreApi2Context $ctx): void
            {
                if ($this->hook_fn !== null) {
                    ($this->hook_fn)();
                }
            }
        };
        $hook_feature->hook_fn = function () use (&$called) { $called = true; };
        $hook_client->features = [$hook_feature];

        ($hook_utility->feature_hook)($ctx, 'TestHook');
        $this->assertTrue($called, 'expected TestHook to be called');
    }


    // === Test: featureInit-basic ===

    public function test_feature_init_basic(): void
    {
        $init_client = PlaystationStoreApi2SDK::test(null, null);
        $init_utility = $init_client->get_utility();
        $ctx = self::make_test_ctx($init_client, $init_utility);
        $ctx->options['feature'] = [
            'initfeat' => ['active' => true],
        ];

        $init_called = false;
        $feature = new class extends PlaystationStoreApi2BaseFeature {
            public $init_fn = null;
            public function __construct()
            {
                parent::__construct();
                $this->name = 'initfeat';
                $this->active = true;
            }
            public function init(PlaystationStoreApi2Context $ctx, array $options): void
            {
                if ($this->init_fn !== null) {
                    ($this->init_fn)();
                }
            }
        };
        $feature->init_fn = function () use (&$init_called) { $init_called = true; };

        ($init_utility->feature_init)($ctx, $feature);
        $this->assertTrue($init_called, 'expected init to be called');
    }


    // === Test: featureInit-inactive ===

    public function test_feature_init_inactive(): void
    {
        $init_client = PlaystationStoreApi2SDK::test(null, null);
        $init_utility = $init_client->get_utility();
        $ctx = self::make_test_ctx($init_client, $init_utility);
        $ctx->options['feature'] = [
            'nofeat' => ['active' => false],
        ];

        $init_called = false;
        $feature = new class extends PlaystationStoreApi2BaseFeature {
            public $init_fn = null;
            public function __construct()
            {
                parent::__construct();
                $this->name = 'nofeat';
                $this->active = false;
            }
            public function init(PlaystationStoreApi2Context $ctx, array $options): void
            {
                if ($this->init_fn !== null) {
                    ($this->init_fn)();
                }
            }
        };
        $feature->init_fn = function () use (&$init_called) { $init_called = true; };

        ($init_utility->feature_init)($ctx, $feature);
        $this->assertFalse($init_called, 'expected init NOT to be called for inactive feature');
    }


    // === Test: fetcher-live ===

    public function test_fetcher_live(): void
    {
        $calls = [];
        $live_client = new PlaystationStoreApi2SDK([
            // Concrete base: a live construction must satisfy any server
            // variables a templated base URL declares; a literal base
            // sidesteps the requirement.
            'base' => 'http://localhost:8080',
            'system' => [
                'fetch' => function (string $url, array $fetchdef) use (&$calls) {
                    $calls[] = ['url' => $url, 'init' => $fetchdef];
                    return [['status' => 200, 'statusText' => 'OK'], null];
                },
            ],
        ]);
        $live_utility = $live_client->get_utility();
        $ctx = ($live_utility->make_context)([
            'opname' => 'load',
            'client' => $live_client,
            'utility' => $live_utility,
        ], null);

        $fetchdef = ['method' => 'GET', 'headers' => []];
        [$_, $err] = ($live_utility->fetcher)($ctx, 'http://example.com/test', $fetchdef);
        $this->assertNull($err, 'expected no error');
        $this->assertCount(1, $calls, 'expected 1 call');
        $this->assertEquals('http://example.com/test', $calls[0]['url']);
    }


    // === Test: fetcher-blocked-test-mode ===

    public function test_fetcher_blocked_test_mode(): void
    {
        $blocked_client = new PlaystationStoreApi2SDK([
            'base' => 'http://localhost:8080',
            'system' => [
                'fetch' => function (string $url, array $fetchdef) {
                    return [[], null];
                },
            ],
        ]);
        $blocked_client->mode = 'test';

        $blocked_utility = $blocked_client->get_utility();
        $ctx = ($blocked_utility->make_context)([
            'opname' => 'load',
            'client' => $blocked_client,
            'utility' => $blocked_utility,
        ], null);

        $fetchdef = ['method' => 'GET', 'headers' => []];
        [$_, $err] = ($blocked_utility->fetcher)($ctx, 'http://example.com/test', $fetchdef);
        $this->assertNotNull($err, 'expected error for test mode fetch');
        $err_msg = ($err instanceof \Throwable) ? $err->getMessage() : (string)$err;
        $this->assertTrue(
            str_contains(strtolower($err_msg), 'blocked'),
            "expected error containing 'blocked', got: {$err_msg}"
        );
    }


    // === Test: makeContext-basic ===

    public function test_make_context_basic(): void
    {
        $utility = self::client()->get_utility();

        $this->runsection('makeContext', function ($vin = null) use ($utility) {
            if (!is_array($vin)) {
                return null;
            }
            $ctx = ($utility->make_context)($vin, null);
            $out = [
                'id' => $ctx->id,
            ];
            if ($ctx->op !== null) {
                $out['op'] = [
                    'name' => $ctx->op->name,
                    'input' => $ctx->op->input,
                ];
            }
            return $out;
        });
    }


    // === Test: makeFetchDef-basic ===

    public function test_make_fetch_def_basic(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new PlaystationStoreApi2Spec([
            'base' => 'http://localhost:8080',
            'prefix' => '/api',
            'path' => 'items/{id}',
            'suffix' => '',
            'params' => ['id' => 'item01'],
            'query' => [],
            'headers' => ['content-type' => 'application/json'],
            'method' => 'GET',
            'step' => 'start',
        ]);
        $ctx->result = new PlaystationStoreApi2Result([]);

        [$fetchdef, $err] = ($utility->make_fetch_def)($ctx);
        $this->assertNull($err, 'should not be error');
        $this->assertNotNull($fetchdef);
        $this->assertEquals('GET', $fetchdef['method']);
        $url = $fetchdef['url'] ?? '';
        $this->assertTrue(str_contains($url, '/api/items/item01'), "expected url to contain /api/items/item01, got {$url}");
        $this->assertEquals('application/json', $fetchdef['headers']['content-type']);
        $this->assertArrayNotHasKey('body', $fetchdef);
    }


    // === Test: makeFetchDef-with-body ===

    public function test_make_fetch_def_with_body(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new PlaystationStoreApi2Spec([
            'base' => 'http://localhost:8080',
            'prefix' => '',
            'path' => 'items',
            'suffix' => '',
            'params' => [],
            'query' => [],
            'headers' => [],
            'method' => 'POST',
            'step' => 'start',
            'body' => ['name' => 'test'],
        ]);
        $ctx->result = new PlaystationStoreApi2Result([]);

        [$fetchdef, $err] = ($utility->make_fetch_def)($ctx);
        $this->assertNull($err, 'should not be error');
        $this->assertNotNull($fetchdef);
        $this->assertEquals('POST', $fetchdef['method']);
        $body_str = $fetchdef['body'] ?? null;
        $this->assertIsString($body_str, 'expected body string');
        $this->assertTrue(str_contains($body_str, '"name"'), "expected body to contain name, got {$body_str}");
    }


    // === Test: makeOptions-basic ===

    public function test_make_options_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('makeOptions', function ($vin = null) use ($client, $utility) {
            if (!is_array($vin)) {
                $vin = [];
            }
            $ctx = ($utility->make_context)([
                'options' => $vin['options'] ?? null,
                'config' => $vin['config'] ?? null,
            ], null);
            $ctx->client = $client;
            $ctx->utility = $utility;
            return ($utility->make_options)($ctx);
        });
    }


    // === Test: makeRequest-basic ===

    public function test_make_request_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('makeRequest', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            $ctx->options = $client->options_map();

            [$_, $err] = ($utility->make_request)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            if ($err !== null) {
                throw $err;
            }
            return null;
        });
    }


    // === Test: makeResponse-basic ===

    public function test_make_response_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('makeResponse', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);

            [$_, $err] = ($utility->make_response)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            if ($err !== null) {
                throw $err;
            }
            return null;
        });
    }


    // === Test: makeResult-basic ===

    public function test_make_result_basic(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new PlaystationStoreApi2Spec([
            'base' => 'http://localhost:8080',
            'prefix' => '/api',
            'path' => 'items/{id}',
            'suffix' => '',
            'params' => ['id' => 'item01'],
            'query' => [],
            'headers' => [],
            'method' => 'GET',
            'step' => 'start',
        ]);
        $ctx->result = new PlaystationStoreApi2Result([
            'ok' => true,
            'status' => 200,
            'statusText' => 'OK',
            'headers' => [],
            'resdata' => ['id' => 'item01', 'name' => 'Test'],
        ]);

        [$result, $err] = ($utility->make_result)($ctx);
        $this->assertNull($err, 'expected no error');
        $this->assertNotNull($result);
        $this->assertEquals(200, $result->status);
    }


    // === Test: makeResult-no-spec ===

    public function test_make_result_no_spec(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = null;
        $ctx->result = new PlaystationStoreApi2Result([
            'ok' => true,
            'status' => 200,
            'statusText' => 'OK',
            'headers' => [],
        ]);

        [$_, $err] = ($utility->make_result)($ctx);
        $this->assertNotNull($err, 'expected error for null spec');
    }


    // === Test: makeResult-no-result ===

    public function test_make_result_no_result(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new PlaystationStoreApi2Spec(['step' => 'start']);
        $ctx->result = null;

        [$_, $err] = ($utility->make_result)($ctx);
        $this->assertNotNull($err, 'expected error for null result');
    }


    // === Test: makeSpec-basic ===

    public function test_make_spec_basic(): void
    {
        $R = self::runpack();
        $setup = $R['spec']['makeSpec']['DEF']['setup']['a'] ?? null;
        $spec_client = PlaystationStoreApi2SDK::test(null, is_array($setup) ? $setup : null);
        $spec_utility = $spec_client->get_utility();
        $utility = self::client()->get_utility();

        $this->runsection('makeSpec', function (array $ctxmap) use ($spec_client, $spec_utility, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $spec_client, $spec_utility);
            $ctx->options = $spec_client->options_map();

            [$_, $err] = ($utility->make_spec)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            if ($err !== null) {
                throw $err;
            }
            return null;
        });
    }


    // === Test: makePoint-basic ===

    public function test_make_point_basic(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_ctx($client, $utility);
        $point = [
            'parts' => ['items', '{id}'],
            'args' => ['params' => []],
            'params' => [],
            'alias' => [],
            'select' => [],
            'active' => true,
            'transform' => [],
        ];
        $ctx->op->points = [$point];

        [$_, $err] = ($utility->make_point)($ctx);
        $this->assertNull($err, 'expected no error');
        $this->assertNotNull($ctx->point, 'expected point to be set');
    }


    // === Test: makeUrl-basic ===

    public function test_make_url_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('makeUrl', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            if ($ctx->result === null) {
                $ctx->result = new PlaystationStoreApi2Result([]);
            }
            return PlaystationStoreApi2Omni::unwrap(($utility->make_url)($ctx));
        });
    }


    // === Test: operator-basic ===

    public function test_operator_basic(): void
    {
        $this->runsection('operator', function ($vin = null) {
            if (!is_array($vin)) {
                $vin = [];
            }
            $op = new PlaystationStoreApi2Operation($vin);
            return [
                'entity' => $op->entity,
                'name' => $op->name,
                'input' => $op->input,
                'points' => $op->points,
            ];
        });
    }


    // === Test: param-basic ===

    public function test_param_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('param', function ($ctxmap = null, $name = null) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map(
                is_array($ctxmap) ? $ctxmap : [], $client, $utility);

            $result = ($utility->param)($ctx, $name);

            if (is_array($ctxmap)) {
                PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            }
            return $result;
        });
    }


    // === Test: prepareAuth-basic ===

    public function test_prepare_auth_basic(): void
    {
        $R = self::runpack();
        $setup = $R['spec']['prepareAuth']['DEF']['setup']['a'] ?? null;
        $auth_client = PlaystationStoreApi2SDK::test(null, is_array($setup) ? $setup : null);
        $auth_utility = $auth_client->get_utility();
        $utility = self::client()->get_utility();

        $this->runsection('prepareAuth', function (array $ctxmap) use ($auth_client, $auth_utility, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $auth_client, $auth_utility);

            [$_, $err] = ($utility->prepare_auth)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            if ($err !== null) {
                throw $err;
            }
            return null;
        });
    }


    // === Test: prepareBody-basic ===

    public function test_prepare_body_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('prepareBody', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            return ($utility->prepare_body)($ctx);
        });
    }


    // === Test: prepareHeaders-basic ===

    public function test_prepare_headers_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('prepareHeaders', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            return ($utility->prepare_headers)($ctx);
        });
    }


    // === Test: prepareMethod-basic ===

    public function test_prepare_method_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('prepareMethod', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            return ($utility->prepare_method)($ctx);
        });
    }


    // === Test: prepareParams-basic ===

    public function test_prepare_params_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('prepareParams', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            return ($utility->prepare_params)($ctx);
        });
    }


    // === Test: preparePath-basic ===

    public function test_prepare_path_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('preparePath', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            return ($utility->prepare_path)($ctx);
        });
    }


    // === Test: preparePath-single ===

    public function test_prepare_path_single(): void
    {
        $client = PlaystationStoreApi2SDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->point = [
            'parts' => ['items'],
            'args' => ['params' => []],
        ];

        $path = ($utility->prepare_path)($ctx);
        $this->assertEquals('items', $path);
    }


    // === Test: prepareQuery-basic ===

    public function test_prepare_query_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('prepareQuery', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);
            return ($utility->prepare_query)($ctx);
        });
    }


    // === Test: resultBasic-basic ===

    public function test_result_basic_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('resultBasic', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);

            $result = ($utility->result_basic)($ctx);

            $out = [
                'status' => $result->status,
                'statusText' => $result->status_text,
            ];
            if ($result->err !== null) {
                $err_msg = ($result->err instanceof PlaystationStoreApi2Error)
                    ? $result->err->msg : (string) $result->err;
                $out['err'] = ['message' => $err_msg];
            }

            return $out;
        });
    }


    // === Test: resultBody-basic ===

    public function test_result_body_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('resultBody', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);

            ($utility->result_body)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            return null;
        });
    }


    // === Test: resultHeaders-basic ===

    public function test_result_headers_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('resultHeaders', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);

            ($utility->result_headers)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            return null;
        });
    }


    // === Test: transformRequest-basic ===

    public function test_transform_request_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('transformRequest', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);

            $result = ($utility->transform_request)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            return $result;
        });
    }


    // === Test: transformResponse-basic ===

    public function test_transform_response_basic(): void
    {
        $client = self::client();
        $utility = $client->get_utility();

        $this->runsection('transformResponse', function (array $ctxmap) use ($client, $utility) {
            $ctx = PlaystationStoreApi2Omni::ctx_from_map($ctxmap, $client, $utility);

            $result = ($utility->transform_response)($ctx);

            PlaystationStoreApi2Omni::sync_ctx($ctxmap, $ctx);
            return $result;
        });
    }
}

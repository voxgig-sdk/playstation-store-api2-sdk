"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const omni_1 = require("../omni");
const index_1 = require("./index");
(0, node_test_1.describe)('PrimaryUtility', async () => {
    let spec;
    let runset;
    let runsetflags;
    let client;
    let utility;
    let struct;
    // Ensure ctx has options derived from client when needed.
    function fixctx(ctx) {
        if (ctx && ctx.client && null == ctx.options) {
            ctx.options = ctx.client.options();
        }
    }
    // Sections deliberately left empty in the shared corpus
    // (.sdk/test/primary/<name>.aon carries a PENDING header). Everything
    // else MUST contribute cases.
    const PENDING = new Set([
        'fetcher', 'makeFetchDef', 'makeResult',
        'featureAdd', 'featureHook', 'featureInit',
    ]);
    // Run one corpus section, failing loudly when it would run ZERO cases.
    // A renamed section or a fixture that compiled to an empty `set` used to
    // pass silently, which defeats the point of a shared oracle. (The guard
    // lives here rather than in runner.ts, which is vendored verbatim from
    // @voxgig/struct and must stay byte-identical to upstream.)
    //
    // EVERY corpus-backed test goes through here — a guard that only some
    // sections opt into leaves the rest able to run zero assertions, which is
    // the exact hole it was added to close.
    async function runsection(name, subject) {
        const section = spec[name];
        (0, node_assert_1.ok)(null != section, `test corpus section '${name}' missing — check the name against .sdk/test/primary/`);
        (0, node_assert_1.ok)(null != section.basic && Array.isArray(section.basic.set), `test corpus section '${name}' has no basic.set list`);
        if (0 === section.basic.set.length && !PENDING.has(name)) {
            throw new Error(`test corpus section '${name}' is EMPTY — zero cases would run; ` +
                `add cases, or mark the fixture PENDING in .sdk/test/primary/`);
        }
        return runset(section.basic, subject);
    }
    (0, node_test_1.before)(async () => {
        const runner = await (0, omni_1.makeRunner)(index_1.TEST_JSON_FILE, await index_1.SDK.test());
        const run = await runner('primary');
        spec = run.spec;
        runset = run.runset;
        runsetflags = run.runsetflags;
        // Under the old hand-vendored runner, run.client WAS the SDK; under
        // omni it is the provider wrapping it. This suite treats the client as
        // the SDK — including ASSIGNING to client._features, which prototype
        // delegation cannot forward — so unwrap the real instance.
        client = run.client.sdk;
        utility = client.utility();
        struct = utility.struct;
    });
    (0, node_test_1.test)('exists', () => {
        const fns = [
            'clean', 'done', 'makeError', 'featureAdd', 'featureHook', 'featureInit',
            'fetcher', 'makeFetchDef', 'makeContext', 'makeOptions', 'makeRequest',
            'makeResponse', 'makeResult', 'makePoint', 'makeSpec', 'makeUrl',
            'param', 'prepareAuth', 'prepareBody', 'prepareHeaders', 'prepareMethod',
            'prepareParams', 'preparePath', 'prepareQuery', 'resultBasic',
            'resultBody', 'resultHeaders', 'transformRequest', 'transformResponse',
        ];
        for (const fn of fns) {
            (0, node_assert_1.equal)('function', typeof utility[fn], fn + ' should be a function');
        }
    });
    (0, node_test_1.test)('context-basic', async () => {
        await runsection('makeContext', utility.makeContext);
    });
    (0, node_test_1.test)('method-basic', async () => {
        await runsection('prepareMethod', utility.prepareMethod);
    });
    (0, node_test_1.test)('headers-basic', async () => {
        await runsection('prepareHeaders', utility.prepareHeaders);
    });
    (0, node_test_1.test)('auth-basic', async () => {
        const sdkopts = spec.prepareAuth?.DEF?.setup?.a || {};
        const authClient = index_1.SDK.test({}, sdkopts);
        await runsection('prepareAuth', (ctx) => {
            ctx.client = authClient;
            fixctx(ctx);
            return utility.prepareAuth(ctx);
        });
    });
    (0, node_test_1.test)('params-basic', async () => {
        await runsection('prepareParams', utility.prepareParams);
    });
    (0, node_test_1.test)('query-basic', async () => {
        await runsection('prepareQuery', utility.prepareQuery);
    });
    (0, node_test_1.test)('body-basic', async () => {
        await runsection('prepareBody', (ctx) => {
            fixctx(ctx);
            return utility.prepareBody(ctx);
        });
    });
    (0, node_test_1.test)('findparam-basic', async () => {
        await runsection('param', utility.param);
    });
    (0, node_test_1.test)('fullurl-basic', async () => {
        await runsection('makeUrl', utility.makeUrl);
    });
    (0, node_test_1.test)('operator-basic', async () => {
        await runsection('operator', (opmap) => ({
            entity: opmap.entity || '_',
            name: opmap.name || '_',
            input: opmap.input || '_',
            points: opmap.points || [],
        }));
    });
    (0, node_test_1.test)('options-basic', async () => {
        await runsection('makeOptions', (vin) => {
            const ctx = utility.makeContext({ options: vin.options, config: vin.config });
            ctx.client = client;
            ctx.utility = utility;
            return utility.makeOptions(ctx);
        });
    });
    (0, node_test_1.test)('spec-basic', async () => {
        const sdkopts = spec.makeSpec?.DEF?.setup?.a || {};
        const specClient = index_1.SDK.test({}, sdkopts);
        await runsection('makeSpec', (ctx) => {
            ctx.client = specClient;
            ctx.options = specClient.options();
            return utility.makeSpec(ctx);
        });
    });
    (0, node_test_1.test)('reqform-basic', async () => {
        await runsection('transformRequest', utility.transformRequest);
    });
    (0, node_test_1.test)('resform-basic', async () => {
        await runsection('transformResponse', utility.transformResponse);
    });
    (0, node_test_1.test)('resbasic-basic', async () => {
        await runsection('resultBasic', (ctx) => {
            fixctx(ctx);
            return utility.resultBasic(ctx);
        });
    });
    (0, node_test_1.test)('resheaders-basic', async () => {
        await runsection('resultHeaders', (ctx) => {
            // Convert plain headers map to forEach-based (browser Response API)
            if (ctx.response?.headers && !ctx.response.headers.forEach) {
                const h = ctx.response.headers;
                ctx.response.headers = {
                    forEach: (cb) => Object.entries(h).forEach(([k, v]) => cb(v, k.toLowerCase()))
                };
            }
            return utility.resultHeaders(ctx);
        });
    });
    (0, node_test_1.test)('resbody-basic', async () => {
        await runsection('resultBody', async (ctx) => {
            if (ctx.response && !ctx.response.json) {
                const body = ctx.response.body;
                ctx.response.json = async () => body;
            }
            return utility.resultBody(ctx);
        });
    });
    (0, node_test_1.test)('request-basic', async () => {
        const mockFetch = async (url, init) => ({
            status: 200,
            statusText: 'OK',
            headers: { forEach: (cb) => { cb('application/json', 'content-type', {}); } },
            json: async () => ({ id: 'res01' }),
            body: 'present',
        });
        const reqClient = new index_1.SDK({
            // Concrete base: a live construction must satisfy any server variables a templated base URL declares; a literal base sidesteps the requirement.
            base: 'http://localhost:8080',
            system: { fetch: mockFetch }
        });
        const reqUtility = reqClient.utility();
        await runsection('makeRequest', async (ctx) => {
            ctx.client = reqClient;
            ctx.utility = reqUtility;
            ctx.options = reqClient.options();
            return reqUtility.makeRequest(ctx);
        });
    });
    (0, node_test_1.test)('response-basic', async () => {
        await runsection('makeResponse', async (ctx) => {
            fixctx(ctx);
            // Add json() and forEach to response for proper TS handling
            if (ctx.response && !ctx.response.json) {
                const body = ctx.response.body;
                ctx.response.json = async () => body;
            }
            if (ctx.response?.headers && !ctx.response.headers.forEach) {
                const h = ctx.response.headers;
                ctx.response.headers = {
                    forEach: (cb) => Object.entries(h).forEach(([k, v]) => cb(v, k.toLowerCase()))
                };
            }
            return utility.makeResponse(ctx);
        });
    });
    (0, node_test_1.test)('done-basic', async () => {
        await runsection('done', (ctx) => {
            fixctx(ctx);
            return utility.done(ctx);
        });
    });
    (0, node_test_1.test)('error-basic', async () => {
        await runsection('makeError', (...args) => {
            const ctx = args[0];
            fixctx(ctx);
            return utility.makeError(...args);
        });
    });
    // Was one hand-written case (the single-point path) covering one of this
    // utility's seven branches, which is how the corpus fixture came to be
    // marked deferred as "needs a real client". It does not: Context rebuilds
    // `op` from opname + entity + config, and `options` can be supplied
    // literally, so allow.op, the empty-points error, exist-selection,
    // $action selection and the invalid-$action error are all expressible.
    // Driven from the corpus now, so every port asserts the same branches.
    (0, node_test_1.test)('makePoint-basic', async () => {
        await runsection('makePoint', utility.makePoint);
    });
    (0, node_test_1.test)('makeFetchDef', () => {
        const ctx = makeFullCtx();
        ctx.spec = {
            base: 'http://localhost:8080',
            prefix: '/api',
            path: 'items/{id}',
            suffix: '',
            params: { id: 'item01' },
            query: {},
            headers: { 'content-type': 'application/json' },
            method: 'GET',
            step: 'start',
            body: undefined,
        };
        const fetchdef = utility.makeFetchDef(ctx);
        (0, node_assert_1.ok)(!(fetchdef instanceof Error), 'should not be error');
        (0, node_assert_1.equal)(fetchdef.method, 'GET');
        (0, node_assert_1.ok)(fetchdef.url.includes('/api/items/item01'));
        (0, node_assert_1.equal)(fetchdef.headers['content-type'], 'application/json');
        (0, node_assert_1.ok)(null == fetchdef.body);
    });
    (0, node_test_1.test)('makeFetchDef-with-body', () => {
        const ctx = makeFullCtx();
        ctx.spec = {
            base: 'http://localhost:8080',
            prefix: '',
            path: 'items',
            suffix: '',
            params: {},
            query: {},
            headers: {},
            method: 'POST',
            step: 'start',
            body: { name: 'test' },
        };
        const fetchdef = utility.makeFetchDef(ctx);
        (0, node_assert_1.ok)(!(fetchdef instanceof Error));
        (0, node_assert_1.equal)(fetchdef.method, 'POST');
        (0, node_assert_1.equal)(fetchdef.body, JSON.stringify({ name: 'test' }, null, 2));
    });
    (0, node_test_1.test)('featureAdd', () => {
        const ctx = makeCtx();
        const startLen = client._features.length;
        const feature = {
            version: '0.0.1',
            name: 'testfeat',
            active: true,
            init: () => { },
        };
        utility.featureAdd(ctx, feature);
        (0, node_assert_1.equal)(client._features.length, startLen + 1);
        (0, node_assert_1.equal)(client._features[client._features.length - 1].name, 'testfeat');
    });
    (0, node_test_1.test)('featureHook', () => {
        const ctx = makeCtx();
        let called = false;
        client._features = [{
                name: 'hookfeat',
                TestHook: () => { called = true; },
            }];
        utility.featureHook(ctx, 'TestHook');
        (0, node_assert_1.equal)(called, true);
    });
    (0, node_test_1.test)('featureInit', () => {
        const ctx = makeCtx();
        let initCalled = false;
        const feature = {
            name: 'initfeat',
            active: true,
            init: () => { initCalled = true; },
        };
        ctx.options.feature.initfeat = { active: true };
        utility.featureInit(ctx, feature);
        (0, node_assert_1.equal)(initCalled, true);
    });
    (0, node_test_1.test)('featureInit-inactive', () => {
        const ctx = makeCtx();
        let initCalled = false;
        const feature = {
            name: 'nofeat',
            active: false,
            init: () => { initCalled = true; },
        };
        ctx.options.feature.nofeat = { active: false };
        utility.featureInit(ctx, feature);
        (0, node_assert_1.equal)(initCalled, false);
    });
    (0, node_test_1.test)('fetcher-live', async () => {
        const calls = [];
        const liveClient = new index_1.SDK({
            base: 'http://localhost:8080',
            system: {
                fetch: async (url, init) => {
                    calls.push({ url, init });
                    return { status: 200, statusText: 'OK' };
                }
            }
        });
        const liveUtility = liveClient.utility();
        const ctx = liveUtility.makeContext({ opname: 'load' }, liveClient._rootctx);
        ctx.client = liveClient;
        const fetchdef = { method: 'GET', headers: {} };
        const response = await liveUtility.fetcher(ctx, 'http://example.com/test', fetchdef);
        (0, node_assert_1.ok)(!(response instanceof Error));
        (0, node_assert_1.equal)(calls.length, 1);
        (0, node_assert_1.equal)(calls[0].url, 'http://example.com/test');
    });
    (0, node_test_1.test)('fetcher-blocked-test-mode', async () => {
        const blockedClient = new index_1.SDK({
            base: 'http://localhost:8080',
            system: { fetch: async () => ({}) }
        });
        blockedClient._mode = 'test';
        const blockedUtility = blockedClient.utility();
        const ctx = blockedUtility.makeContext({ opname: 'load' }, blockedClient._rootctx);
        ctx.client = blockedClient;
        const fetchdef = { method: 'GET', headers: {} };
        const result = await blockedUtility.fetcher(ctx, 'http://example.com/test', fetchdef);
        (0, node_assert_1.ok)(result instanceof Error);
        (0, node_assert_1.ok)(result.message.includes('mode'));
    });
    (0, node_test_1.test)('makeError-no-throw', () => {
        const ctx = makeFullCtx();
        ctx.ctrl.throw = false;
        ctx.result = { ok: false, resdata: { id: 'safe01' } };
        const out = utility.makeError(ctx, ctx.error('test_code', 'test message'));
        (0, node_assert_1.deepStrictEqual)(out, { id: 'safe01' });
    });
    (0, node_test_1.test)('path-basic', async () => {
        // preparePath shipped as an empty `set: []` — every port "passed" it while
        // running zero cases. Now corpus-driven like every other section.
        await runsection('preparePath', (ctx) => utility.preparePath(ctx));
    });
    (0, node_test_1.test)('clean-corpus', async () => {
        await runsection('clean', (...args) => utility.clean(args[0], args[1]));
    });
    (0, node_test_1.test)('clean', () => {
        const ctx = makeFullCtx();
        const val = { key: 'secret123', name: 'test' };
        const cleaned = utility.clean(ctx, val);
        (0, node_assert_1.ok)(null != cleaned);
    });
    // Helper functions for manual tests
    function makeCtx(overrides) {
        return utility.makeContext({
            opname: 'load',
            ...overrides,
        }, client._rootctx);
    }
    function makeFullCtx(overrides) {
        const ctx = makeCtx(overrides);
        ctx.point = {
            parts: ['items', '{id}'],
            args: { params: [{ name: 'id', reqd: true }] },
            params: ['id'],
            alias: {},
            select: {},
            active: true,
            relations: [],
            transform: { req: undefined, res: undefined },
        };
        ctx.match = { id: 'item01' };
        ctx.reqmatch = { id: 'item01' };
        return ctx;
    }
});
//# sourceMappingURL=PrimaryUtility.test.js.map
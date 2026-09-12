"use strict";
// Direct unit tests for the operation-pipeline utilities. The generated
// entity tests exercise the happy path; these drive the error and edge
// branches (missing spec/response/result, 4xx handling, transport
// failures, feature ordering, auth header shaping) that a normal
// success-path op never reaches. All utilities are reached through
// `stdutil`, so this suite is API-agnostic.
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const __1 = require("..");
const struct = __1.stdutil.struct;
function err(code, msg) {
    const e = new Error(msg);
    e.code = code;
    return e;
}
// Transport-shaped response with a re-readable body + header iterator.
function resp(status, data, headers) {
    const h = {};
    for (const k of Object.keys(headers || {})) {
        h[k.toLowerCase()] = headers[k];
    }
    return {
        status,
        statusText: status < 400 ? 'OK' : 'ERR',
        body: 'body',
        json: async () => data,
        headers: {
            get: (k) => h[String(k).toLowerCase()],
            forEach: (cb) => Object.keys(h).forEach((k) => cb(h[k], k)),
        },
    };
}
function base(over) {
    return {
        utility: __1.stdutil,
        error: err,
        ctrl: {},
        out: {},
        op: { name: 'load', entity: 'x' },
        ...over,
    };
}
// A utility view whose fetcher is overridden (for makeRequest tests).
function utilWith(fetcher) {
    return Object.assign(Object.create(__1.stdutil), { fetcher });
}
(0, node_test_1.describe)('pipeline:makePoint + makeSpec', () => {
    const allow = { op: 'load,list,create,update,remove', method: 'GET,PUT,POST,PATCH,DELETE' };
    (0, node_test_1.test)('makePoint rejects a disallowed operation', () => {
        const ctx = base({ op: { name: 'nope', points: [] }, options: { allow: { op: 'load' } } });
        (0, node_assert_1.strictEqual)(__1.stdutil.makePoint(ctx).code, 'point_op_allow');
    });
    (0, node_test_1.test)('makePoint rejects an operation with no endpoints', () => {
        const ctx = base({ op: { name: 'load', points: [] }, options: { allow } });
        (0, node_assert_1.strictEqual)(__1.stdutil.makePoint(ctx).code, 'point_no_points');
    });
    (0, node_test_1.test)('makePoint returns the single point', () => {
        const point = { method: 'GET', parts: ['a'] };
        const ctx = base({ op: { name: 'load', points: [point] }, options: { allow } });
        (0, node_assert_1.strictEqual)(__1.stdutil.makePoint(ctx), point);
    });
    (0, node_test_1.test)('makePoint short-circuits a feature-supplied point', () => {
        const preset = { method: 'GET' };
        (0, node_assert_1.strictEqual)(__1.stdutil.makePoint(base({ out: { point: preset } })), preset);
    });
    (0, node_test_1.test)('makeSpec short-circuits a feature-supplied spec', () => {
        const preset = { method: 'GET' };
        (0, node_assert_1.strictEqual)(__1.stdutil.makeSpec(base({ out: { spec: preset } })), preset);
    });
});
(0, node_test_1.describe)('pipeline:makeResponse', () => {
    (0, node_test_1.test)('guards missing spec / response / result', async () => {
        const u = __1.stdutil;
        (0, node_assert_1.strictEqual)((await u.makeResponse(base({ spec: null, response: {}, result: {} }))).code, 'response_no_spec');
        (0, node_assert_1.strictEqual)((await u.makeResponse(base({ spec: {}, response: null, result: {} }))).code, 'response_no_response');
        (0, node_assert_1.strictEqual)((await u.makeResponse(base({ spec: {}, response: {}, result: null }))).code, 'response_no_result');
    });
    (0, node_test_1.test)('a 4xx response sets result.err and copies headers', async () => {
        const ctx = base({ spec: { step: 's' }, response: resp(404, undefined, { 'x-a': '1' }), result: { ok: false } });
        await __1.stdutil.makeResponse(ctx);
        (0, node_assert_1.ok)(null != ctx.result.err);
        (0, node_assert_1.strictEqual)(ctx.result.status, 404);
        (0, node_assert_1.strictEqual)(ctx.result.headers['x-a'], '1');
    });
    (0, node_test_1.test)('a 2xx response parses the body and marks ok', async () => {
        const ctx = base({ spec: { step: 's' }, response: resp(200, { v: 1 }), result: { ok: false } });
        await __1.stdutil.makeResponse(ctx);
        (0, node_assert_1.strictEqual)(ctx.result.ok, true);
        (0, node_assert_1.deepStrictEqual)(ctx.result.body, { v: 1 });
    });
    (0, node_test_1.test)('records to ctrl.explain when explain is on', async () => {
        const ctx = base({ ctrl: { explain: {} }, spec: { step: 's' }, response: resp(200, { v: 2 }), result: { ok: false } });
        await __1.stdutil.makeResponse(ctx);
        (0, node_assert_1.ok)(null != ctx.ctrl.explain.result);
    });
    (0, node_test_1.test)('a body-parse exception is captured on result.err', async () => {
        const throwing = resp(200, undefined);
        throwing.json = async () => { throw new Error('bad json'); };
        const ctx = base({ spec: { step: 's' }, response: throwing, result: { ok: false } });
        await __1.stdutil.makeResponse(ctx);
        (0, node_assert_1.ok)(null != ctx.result.err);
    });
    (0, node_test_1.test)('short-circuits when a feature already supplied the response', async () => {
        const preset = resp(299);
        const ctx = base({ out: { response: preset }, spec: {}, response: {}, result: {} });
        (0, node_assert_1.strictEqual)(await __1.stdutil.makeResponse(ctx), preset);
    });
});
(0, node_test_1.describe)('pipeline:makeResult', () => {
    (0, node_test_1.test)('guards missing spec / result', () => {
        const u = __1.stdutil;
        (0, node_assert_1.strictEqual)(u.makeResult(base({ spec: null, result: {} })).code, 'result_no_spec');
        (0, node_assert_1.strictEqual)(u.makeResult(base({ spec: {}, result: null })).code, 'result_no_result');
    });
    (0, node_test_1.test)('list op wraps resdata into entity instances', () => {
        const made = [];
        const entity = { make: () => ({ data: (d) => made.push(d) }) };
        const ctx = base({
            op: { name: 'list', entity: 'x' }, entity,
            spec: { step: 's' }, result: { resdata: [{ a: 1 }, { a: 2 }] },
        });
        const r = __1.stdutil.makeResult(ctx);
        (0, node_assert_1.strictEqual)(r.resdata.length, 2);
        (0, node_assert_1.strictEqual)(made.length, 2);
    });
    (0, node_test_1.test)('an empty list yields an empty resdata array', () => {
        const ctx = base({ op: { name: 'list', entity: 'x' }, entity: { make: () => ({ data: () => { } }) }, spec: { step: 's' }, result: { resdata: [] } });
        const r = __1.stdutil.makeResult(ctx);
        (0, node_assert_1.deepStrictEqual)(r.resdata, []);
    });
    (0, node_test_1.test)('short-circuits on a preset result', () => {
        const preset = { ok: true };
        (0, node_assert_1.strictEqual)(__1.stdutil.makeResult(base({ out: { result: preset }, spec: {}, result: {} })), preset);
    });
});
(0, node_test_1.describe)('pipeline:makeRequest', () => {
    (0, node_test_1.test)('guards a missing spec', async () => {
        (0, node_assert_1.strictEqual)((await __1.stdutil.makeRequest(base({ spec: null }))).code, 'request_no_spec');
    });
    (0, node_test_1.test)('a null transport result becomes a response error', async () => {
        const ctx = base({ utility: utilWith(async () => null), spec: { step: 's', method: 'GET', headers: {} } });
        const r = await __1.stdutil.makeRequest(ctx);
        (0, node_assert_1.ok)(null != r.err);
    });
    (0, node_test_1.test)('an Error transport result is carried on the response', async () => {
        const boom = err('boom', 'boom');
        const ctx = base({ utility: utilWith(async () => boom), spec: { step: 's', method: 'GET', headers: {} } });
        const r = await __1.stdutil.makeRequest(ctx);
        (0, node_assert_1.strictEqual)(r.err, boom);
    });
    (0, node_test_1.test)('a normal transport response is wrapped', async () => {
        const ctx = base({ utility: utilWith(async () => resp(200, { a: 1 })), spec: { step: 's', method: 'GET', headers: {} } });
        const r = await __1.stdutil.makeRequest(ctx);
        (0, node_assert_1.strictEqual)(r.status, 200);
    });
    (0, node_test_1.test)('records the fetchdef to ctrl.explain', async () => {
        const ctx = base({
            ctrl: { explain: {} },
            utility: utilWith(async () => resp(200, {})),
            spec: { step: 's', method: 'GET', headers: {} },
        });
        await __1.stdutil.makeRequest(ctx);
        (0, node_assert_1.ok)(null != ctx.ctrl.explain.fetchdef);
    });
    (0, node_test_1.test)('a fetchdef error surfaces as a response error', async () => {
        const u = Object.assign(Object.create(__1.stdutil), {
            makeFetchDef: () => err('fetchdef_boom', 'boom'),
        });
        const ctx = base({ utility: u, spec: { step: 's', method: 'GET', headers: {} } });
        const r = await __1.stdutil.makeRequest(ctx);
        (0, node_assert_1.ok)(null != r.err);
    });
    (0, node_test_1.test)('short-circuits a feature-supplied request', async () => {
        const preset = resp(201);
        (0, node_assert_1.strictEqual)(await __1.stdutil.makeRequest(base({ out: { request: preset }, spec: {} })), preset);
    });
});
(0, node_test_1.describe)('pipeline:makeFetchDef', () => {
    (0, node_test_1.test)('guards a missing spec', () => {
        (0, node_assert_1.strictEqual)(__1.stdutil.makeFetchDef(base({ spec: null })).code, 'fetchdef_no_spec');
    });
    (0, node_test_1.test)('serialises an object body to JSON and inits a missing result', () => {
        const ctx = base({
            result: null,
            spec: { step: 's', method: 'POST', headers: {}, base: 'http://h', prefix: '', suffix: '', parts: ['a'], body: { x: 1 } },
        });
        const fd = __1.stdutil.makeFetchDef(ctx);
        (0, node_assert_1.strictEqual)(typeof fd.body, 'string');
        (0, node_assert_1.ok)(fd.url.includes('http://h'));
        (0, node_assert_1.ok)(null != ctx.result); // result was lazily created
    });
});
(0, node_test_1.describe)('pipeline:makeError + done', () => {
    (0, node_test_1.test)('done returns resdata on success', () => {
        (0, node_assert_1.strictEqual)(__1.stdutil.done(base({ result: { ok: true, resdata: 42 } })), 42);
    });
    (0, node_test_1.test)('done throws the error when not ok', () => {
        let threw = false;
        try {
            __1.stdutil.done(base({ result: { ok: false } }));
        }
        catch (e) {
            threw = true;
        }
        (0, node_assert_1.strictEqual)(threw, true);
    });
    (0, node_test_1.test)('done cleans ctrl.explain on success', () => {
        const ctx = base({ ctrl: { explain: { result: { err: 'x' } } }, result: { ok: true, resdata: 7 } });
        (0, node_assert_1.strictEqual)(__1.stdutil.done(ctx), 7);
    });
    (0, node_test_1.test)('makeError returns resdata instead of throwing when ctrl.throw is false', () => {
        const ctx = base({ ctrl: { throw: false }, result: { ok: false, resdata: 'fallback' } });
        (0, node_assert_1.strictEqual)(__1.stdutil.makeError(ctx), 'fallback');
    });
    (0, node_test_1.test)('makeError records to ctrl.explain', () => {
        const ctx = base({ ctrl: { throw: false, explain: {} }, result: { ok: false } });
        __1.stdutil.makeError(ctx);
        (0, node_assert_1.ok)(null != ctx.ctrl.explain.err);
    });
});
(0, node_test_1.describe)('pipeline:featureAdd ordering', () => {
    function client() { return { _features: [{ name: 'a' }, { name: 'b' }] }; }
    (0, node_test_1.test)('appends by default', () => {
        const c = client();
        __1.stdutil.featureAdd({ client: c, utility: __1.stdutil }, { name: 'z', _options: {} });
        (0, node_assert_1.strictEqual)(c._features.map((f) => f.name).join(','), 'a,b,z');
    });
    (0, node_test_1.test)('__before__ inserts ahead of the named feature', () => {
        const c = client();
        __1.stdutil.featureAdd({ client: c, utility: __1.stdutil }, { name: 'z', _options: { __before__: 'b' } });
        (0, node_assert_1.strictEqual)(c._features.map((f) => f.name).join(','), 'a,z,b');
    });
    (0, node_test_1.test)('__after__ inserts behind the named feature', () => {
        const c = client();
        __1.stdutil.featureAdd({ client: c, utility: __1.stdutil }, { name: 'z', _options: { __after__: 'a' } });
        (0, node_assert_1.strictEqual)(c._features.map((f) => f.name).join(','), 'a,z,b');
    });
    (0, node_test_1.test)('__replace__ swaps the named feature', () => {
        const c = client();
        __1.stdutil.featureAdd({ client: c, utility: __1.stdutil }, { name: 'z', _options: { __replace__: 'a' } });
        (0, node_assert_1.strictEqual)(c._features.map((f) => f.name).join(','), 'z,b');
    });
});
(0, node_test_1.describe)('pipeline:feature order', () => {
    function resolve(feature) {
        const ctx = { utility: __1.stdutil, options: { feature }, config: { options: {} } };
        return __1.stdutil.makeOptions(ctx);
    }
    (0, node_test_1.test)('map form is ordered test-first (test is the base transport)', () => {
        const o = resolve({ metrics: { active: true }, test: { active: true } });
        (0, node_assert_1.strictEqual)(o.__derived__.featureorder.join(','), 'test,metrics');
    });
    (0, node_test_1.test)('array form preserves the explicit developer-specified order', () => {
        const o = resolve([{ name: 'metrics', active: true }, { name: 'test', active: true }]);
        (0, node_assert_1.strictEqual)(o.__derived__.featureorder.join(','), 'metrics,test');
        // the array is normalized to a map for merge/init, opts preserved
        (0, node_assert_1.strictEqual)(o.feature.metrics.active, true);
        (0, node_assert_1.strictEqual)(o.feature.test.active, true);
    });
    (0, node_test_1.test)('map form with no test orders names deterministically', () => {
        const o = resolve({ retry: { active: true }, cache: { active: true } });
        (0, node_assert_1.strictEqual)(o.__derived__.featureorder.join(','), 'cache,retry');
    });
});
(0, node_test_1.describe)('pipeline:prepareAuth', () => {
    // Fake client so the exact options.auth / apikey shape is controlled.
    function authCtx(options, headers) {
        return base({ client: { options: () => options }, spec: headers == null ? null : { headers } });
    }
    (0, node_test_1.test)('guards a missing spec', () => {
        (0, node_assert_1.strictEqual)(__1.stdutil.prepareAuth(authCtx({ auth: { prefix: '' }, apikey: 'K' }, null)).code, 'auth_no_spec');
    });
    (0, node_test_1.test)('an apikey with a prefix is space-joined', () => {
        const ctx = authCtx({ apikey: 'K', auth: { prefix: 'Bearer' } }, {});
        __1.stdutil.prepareAuth(ctx);
        (0, node_assert_1.strictEqual)(ctx.spec.headers.authorization, 'Bearer K');
    });
    (0, node_test_1.test)('a raw apikey (empty prefix) goes in as-is', () => {
        const ctx = authCtx({ apikey: 'K', auth: { prefix: '' } }, {});
        __1.stdutil.prepareAuth(ctx);
        (0, node_assert_1.strictEqual)(ctx.spec.headers.authorization, 'K');
    });
    (0, node_test_1.test)('an empty apikey drops the header', () => {
        const ctx = authCtx({ apikey: '', auth: { prefix: 'Bearer' } }, { authorization: 'stale' });
        __1.stdutil.prepareAuth(ctx);
        (0, node_assert_1.strictEqual)(ctx.spec.headers.authorization, undefined);
    });
    (0, node_test_1.test)('a public API (no auth block) drops the header', () => {
        const ctx = authCtx({ apikey: 'K' }, { authorization: 'stale' });
        __1.stdutil.prepareAuth(ctx);
        (0, node_assert_1.strictEqual)(ctx.spec.headers.authorization, undefined);
    });
    (0, node_test_1.test)('a missing apikey option drops the header', () => {
        const ctx = authCtx({ auth: { prefix: 'Bearer' } }, { authorization: 'stale' });
        __1.stdutil.prepareAuth(ctx);
        (0, node_assert_1.strictEqual)(ctx.spec.headers.authorization, undefined);
    });
});
(0, node_test_1.describe)('pipeline:result helpers', () => {
    (0, node_test_1.test)('resultHeaders with no forEach yields an empty map', () => {
        const ctx = base({ response: { headers: {} }, result: {} });
        __1.stdutil.resultHeaders(ctx);
        (0, node_assert_1.deepStrictEqual)(ctx.result.headers, {});
    });
    (0, node_test_1.test)('resultBody skips parsing when the body is absent', async () => {
        const ctx = base({ response: { json: async () => ({ a: 1 }), body: null }, result: {} });
        await __1.stdutil.resultBody(ctx);
        (0, node_assert_1.strictEqual)(ctx.result.body, undefined);
    });
});
//# sourceMappingURL=pipeline.test.js.map
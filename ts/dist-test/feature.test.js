"use strict";
// Behavioural + coverage tests for the enterprise features shipped with
// this SDK. Each block runs only when its feature is present (see
// hasFeature), driving the real generated feature class through the offline
// harness pipeline against a simulated network.
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const harness_1 = require("./feature/harness");
function recordingServer(reply) {
    const calls = [];
    const server = (_ctx, url, fetchdef) => {
        calls.push({ url, fetchdef });
        if (reply) {
            return reply(calls.length, fetchdef);
        }
        return (0, harness_1.makeResponse)(200, { ok: true, n: calls.length });
    };
    return { server, calls };
}
// A subtest that drives a second feature (netsim as the simulated network)
// can only run when this SDK was generated with it: the harness skips
// absent features, which would leave the scenario unsimulated and the
// assertions meaningless. Same convention as the other targets.
function skipWithout(name) {
    return (0, harness_1.hasFeature)(name) ? false
        : ('this SDK was generated without the ' + name + ' feature');
}
(0, node_test_1.describe)('feature', () => {
    (0, node_test_1.test)('at least the test feature is present', () => {
        (0, node_assert_1.strictEqual)((0, harness_1.hasFeature)('test'), true);
    });
    // --- netsim ---------------------------------------------------------------
    if ((0, harness_1.hasFeature)('netsim'))
        (0, node_test_1.describe)('netsim', () => {
            (0, node_test_1.test)('fixed latency then delegate', async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { latency: 250, sleep: clock.sleep } }] });
                const res = await h.op({ op: 'load', ctrl: { explain: {} } });
                (0, node_assert_1.strictEqual)(res.ok, true);
                (0, node_assert_1.strictEqual)(clock.time, 250);
                (0, node_assert_1.strictEqual)(h.client._netsim.calls, 1);
            });
            (0, node_test_1.test)('ranged latency samples within [min,max)', async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { latency: { min: 100, max: 300 }, seed: 7, sleep: clock.sleep } }] });
                await h.op({ op: 'load' });
                (0, node_assert_1.ok)(clock.time >= 100 && clock.time < 300, 'latency in range, got ' + clock.time);
            });
            (0, node_test_1.test)('equal min/max latency is exact', async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { latency: { min: 50, max: 50 }, sleep: clock.sleep } }] });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(clock.time, 50);
            });
            (0, node_test_1.test)('failTimes returns a retryable status', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { failTimes: 2, failStatus: 503 } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).result.status, 503);
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).result.status, 503);
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
            (0, node_test_1.test)('failEvery fails every Nth call', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { failEvery: 2 } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, false);
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
            (0, node_test_1.test)('failRate with a seed is deterministic', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { failRate: 1, seed: 5 } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, false);
            });
            (0, node_test_1.test)('errorTimes throws a connection error', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { errorTimes: 1 } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).error.code, 'netsim_conn');
            });
            (0, node_test_1.test)('offline fails every call', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { offline: true } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).error.code, 'netsim_offline');
            });
            (0, node_test_1.test)('rateLimitTimes returns 429 + Retry-After', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { rateLimitTimes: 1, retryAfter: 3 } }] });
                const res = await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(res.result.status, 429);
                (0, node_assert_1.strictEqual)(res.result.headers['retry-after'], '3');
            });
        });
    // --- retry ----------------------------------------------------------------
    if ((0, harness_1.hasFeature)('retry'))
        (0, node_test_1.describe)('retry', () => {
            (0, node_test_1.test)('retries transient failures then succeeds', { skip: skipWithout('netsim') }, async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { failTimes: 2, failStatus: 503 } },
                        { name: 'retry', options: { retries: 3, minDelay: 10, jitter: false, sleep: clock.sleep } },
                    ] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
                (0, node_assert_1.strictEqual)(h.client._retry.attempts, 2);
            });
            (0, node_test_1.test)('gives up after the budget', { skip: skipWithout('netsim') }, async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { failTimes: 9, failStatus: 500 } },
                        { name: 'retry', options: { retries: 2, minDelay: 1, jitter: false, sleep: clock.sleep } },
                    ] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).result.status, 500);
            });
            (0, node_test_1.test)('does not retry a non-retryable status', async () => {
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(404));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'retry', options: { retries: 3, minDelay: 0 } }], server: rec.server });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 1);
            });
            (0, node_test_1.test)('retries a thrown transport error then rethrows when exhausted', async () => {
                const clock = (0, harness_1.makeClock)();
                let n = 0;
                const server = () => { n++; throw new Error('boom'); };
                const h = (0, harness_1.makeClient)({ features: [{ name: 'retry', options: { retries: 2, minDelay: 1, jitter: false, sleep: clock.sleep } }], server });
                const res = await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(res.ok, false);
                (0, node_assert_1.strictEqual)(n, 3);
            });
            (0, node_test_1.test)('honours a server Retry-After', { skip: skipWithout('netsim') }, async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { rateLimitTimes: 1, retryAfter: 2 } },
                        { name: 'retry', options: { retries: 2, minDelay: 10, maxDelay: 60000, jitter: false, sleep: clock.sleep } },
                    ] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
                (0, node_assert_1.strictEqual)(clock.time, 2000);
            });
            (0, node_test_1.test)('default jitter path still succeeds', { skip: skipWithout('netsim') }, async () => {
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { failTimes: 1 } },
                        { name: 'retry', options: { retries: 2, minDelay: 0 } },
                    ] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
        });
    // --- timeout --------------------------------------------------------------
    if ((0, harness_1.hasFeature)('timeout'))
        (0, node_test_1.describe)('timeout', () => {
            (0, node_test_1.test)('a slow request times out', { skip: skipWithout('netsim') }, async () => {
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { latency: 80 } },
                        { name: 'timeout', options: { ms: 10 } },
                    ] });
                const res = await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(res.error.code, 'timeout');
                (0, node_assert_1.strictEqual)(h.client._timeout.count, 1);
            });
            (0, node_test_1.test)('a fast request passes through', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'timeout', options: { ms: 1000 } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
            (0, node_test_1.test)('ms<=0 disables the timeout', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'timeout', options: { ms: 0 } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
        });
    // --- ratelimit ------------------------------------------------------------
    if ((0, harness_1.hasFeature)('ratelimit'))
        (0, node_test_1.describe)('ratelimit', () => {
            (0, node_test_1.test)('throttles once the burst is spent', async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'ratelimit', options: { rate: 1, burst: 2, now: clock.now, sleep: clock.sleep } }] });
                await h.op({ op: 'load' });
                await h.op({ op: 'load' });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(h.client._ratelimit.throttled, 1);
                (0, node_assert_1.ok)(clock.time > 0);
            });
            (0, node_test_1.test)('burst defaults to rate and refills over time', async () => {
                const clock = (0, harness_1.makeClock)();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'ratelimit', options: { rate: 2, now: clock.now, sleep: clock.sleep } }] });
                await h.op({ op: 'load' });
                await h.op({ op: 'load' });
                clock.advance(1000); // refill
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(h.client._ratelimit == null ? 0 : h.client._ratelimit.throttled, 0);
            });
        });
    // --- cache ----------------------------------------------------------------
    if ((0, harness_1.hasFeature)('cache'))
        (0, node_test_1.describe)('cache', () => {
            (0, node_test_1.test)('serves a repeated read from cache', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'cache', options: { ttl: 10000 } }], server: rec.server });
                const a = await h.op({ op: 'load', path: '/w/1' });
                const b = await h.op({ op: 'load', path: '/w/1' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 1);
                (0, node_assert_1.deepStrictEqual)(a.data, b.data);
                (0, node_assert_1.strictEqual)(h.client._cache.hit, 1);
            });
            (0, node_test_1.test)('does not cache non-GET', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'cache' }], server: rec.server });
                await h.op({ op: 'create', path: '/w' });
                await h.op({ op: 'create', path: '/w' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 2);
            });
            (0, node_test_1.test)('does not cache a non-2xx (bypass)', async () => {
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(500));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'cache' }], server: rec.server });
                await h.op({ op: 'load', path: '/w' });
                await h.op({ op: 'load', path: '/w' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 2);
                (0, node_assert_1.strictEqual)(h.client._cache.bypass, 2);
            });
            (0, node_test_1.test)('re-fetches after the ttl', async () => {
                const clock = (0, harness_1.makeClock)();
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'cache', options: { ttl: 1000, now: clock.now } }], server: rec.server });
                await h.op({ op: 'load', path: '/w' });
                clock.advance(1500);
                await h.op({ op: 'load', path: '/w' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 2);
            });
            (0, node_test_1.test)('evicts the oldest entry past max', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'cache', options: { ttl: 10000, max: 1 } }], server: rec.server });
                await h.op({ op: 'load', path: '/a' });
                await h.op({ op: 'load', path: '/b' }); // evicts /a
                await h.op({ op: 'load', path: '/a' }); // miss again
                (0, node_assert_1.strictEqual)(rec.calls.length, 3);
            });
        });
    // --- idempotency ----------------------------------------------------------
    if ((0, harness_1.hasFeature)('idempotency'))
        (0, node_test_1.describe)('idempotency', () => {
            (0, node_test_1.test)('adds a key to mutating ops', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'idempotency' }], server: rec.server });
                await h.op({ op: 'create', path: '/w' });
                (0, node_assert_1.ok)(null != rec.calls[0].fetchdef.headers['Idempotency-Key']);
            });
            (0, node_test_1.test)('adds a key based on HTTP method', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'idempotency' }], server: rec.server });
                await h.op({ op: 'act', method: 'PUT', path: '/w' });
                (0, node_assert_1.ok)(null != rec.calls[0].fetchdef.headers['Idempotency-Key']);
            });
            (0, node_test_1.test)('leaves reads untouched', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'idempotency' }], server: rec.server });
                await h.op({ op: 'load', path: '/w/1' });
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.headers['Idempotency-Key'], undefined);
            });
            (0, node_test_1.test)('preserves a caller key and honours a custom header', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'idempotency', options: { header: 'X-Idem' } }], server: rec.server });
                await h.op({ op: 'create', path: '/w', headers: { 'X-Idem': 'caller-1' } });
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.headers['X-Idem'], 'caller-1');
            });
        });
    // --- rbac -----------------------------------------------------------------
    if ((0, harness_1.hasFeature)('rbac'))
        (0, node_test_1.describe)('rbac', () => {
            (0, node_test_1.test)('denies before any call', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'rbac', options: { rules: { 'widget.remove': 'admin' }, permissions: [] } }], server: rec.server });
                const res = await h.op({ op: 'remove', path: '/w/1' });
                (0, node_assert_1.strictEqual)(res.error.code, 'rbac_denied');
                (0, node_assert_1.strictEqual)(rec.calls.length, 0);
                (0, node_assert_1.strictEqual)(h.client._rbac.denied, 1);
            });
            (0, node_test_1.test)('allows a held permission', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'rbac', options: { rules: { 'widget.remove': 'admin' }, permissions: ['admin'] } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'remove', path: '/w/1' })).ok, true);
            });
            (0, node_test_1.test)('rule by op name and wildcard grant', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'rbac', options: { rules: { load: 'read' }, permissions: ['*'] } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
            (0, node_test_1.test)('no rule allows by default; deny:true blocks', async () => {
                const allow = (0, harness_1.makeClient)({ features: [{ name: 'rbac', options: { permissions: [] } }] });
                (0, node_assert_1.strictEqual)((await allow.op({ op: 'load' })).ok, true);
                const deny = (0, harness_1.makeClient)({ features: [{ name: 'rbac', options: { deny: true, permissions: [] } }] });
                (0, node_assert_1.strictEqual)((await deny.op({ op: 'load' })).error.code, 'rbac_denied');
            });
        });
    // --- metrics --------------------------------------------------------------
    if ((0, harness_1.hasFeature)('metrics'))
        (0, node_test_1.describe)('metrics', () => {
            (0, node_test_1.test)('counts ok and err per op', { skip: skipWithout('netsim') }, async () => {
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
                        { name: 'metrics', options: {} },
                    ] });
                await h.op({ op: 'load' });
                await h.op({ op: 'load' });
                await h.op({ op: 'list' });
                const m = h.client._metrics;
                (0, node_assert_1.strictEqual)(m.total.count, 3);
                (0, node_assert_1.strictEqual)(m.total.ok, 2);
                (0, node_assert_1.strictEqual)(m.total.err, 1);
                (0, node_assert_1.strictEqual)(m.ops['widget.load'].count, 2);
            });
        });
    // --- telemetry ------------------------------------------------------------
    if ((0, harness_1.hasFeature)('telemetry'))
        (0, node_test_1.describe)('telemetry', () => {
            (0, node_test_1.test)('opens spans and propagates trace headers', async () => {
                const rec = recordingServer();
                const spans = [];
                const h = (0, harness_1.makeClient)({ features: [{ name: 'telemetry', options: { exporter: (s) => spans.push(s) } }], server: rec.server });
                const res = await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(res.ok, true);
                (0, node_assert_1.strictEqual)(h.client._telemetry.spans.length, 1);
                (0, node_assert_1.strictEqual)(spans.length, 1);
                const sent = rec.calls[0].fetchdef.headers;
                (0, node_assert_1.strictEqual)(sent['X-Trace-Id'], h.client._telemetry.spans[0].traceId);
                (0, node_assert_1.ok)(/^00-.+-.+-01$/.test(sent['traceparent']));
            });
            (0, node_test_1.test)('records a failed span on error', { skip: skipWithout('netsim') }, async () => {
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
                        { name: 'telemetry', options: {} },
                    ] });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(h.client._telemetry.spans[0].ok, false);
            });
        });
    // --- debug ----------------------------------------------------------------
    if ((0, harness_1.hasFeature)('debug'))
        (0, node_test_1.describe)('debug', () => {
            (0, node_test_1.test)('captures a redacted trace and honours onEntry + max', async () => {
                const seen = [];
                const h = (0, harness_1.makeClient)({ features: [{ name: 'debug', options: { max: 1, onEntry: (e) => seen.push(e) } }] });
                await h.op({ op: 'load', headers: { authorization: 'Bearer secret' } });
                await h.op({ op: 'list' });
                const entries = h.client._debug.entries;
                (0, node_assert_1.strictEqual)(entries.length, 1); // ring buffer capped at max
                (0, node_assert_1.strictEqual)(seen.length, 2);
                (0, node_assert_1.strictEqual)(seen[0].headers.authorization, '<redacted>');
            });
            (0, node_test_1.test)('captures failures', { skip: skipWithout('netsim') }, async () => {
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
                        { name: 'debug', options: {} },
                    ] });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(h.client._debug.entries[0].ok, false);
            });
        });
    // --- audit ----------------------------------------------------------------
    if ((0, harness_1.hasFeature)('audit'))
        (0, node_test_1.describe)('audit', () => {
            (0, node_test_1.test)('one record per op with sink + actor', { skip: skipWithout('netsim') }, async () => {
                const sink = [];
                const h = (0, harness_1.makeClient)({ features: [
                        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
                        { name: 'audit', options: { actor: 'svc', sink: (r) => sink.push(r), max: 5 } },
                    ] });
                await h.op({ op: 'remove', path: '/w/1' });
                await h.op({ op: 'load', ctrl: { actor: 'per-call' } });
                const recs = h.client._audit.records;
                (0, node_assert_1.strictEqual)(recs.length, 2);
                (0, node_assert_1.strictEqual)(recs[0].outcome, 'error');
                (0, node_assert_1.strictEqual)(recs[0].actor, 'svc');
                (0, node_assert_1.strictEqual)(recs[1].actor, 'per-call');
                (0, node_assert_1.strictEqual)(sink.length, 2);
            });
        });
    // --- clienttrack ----------------------------------------------------------
    if ((0, harness_1.hasFeature)('clienttrack'))
        (0, node_test_1.describe)('clienttrack', () => {
            (0, node_test_1.test)('stable client id, unique request ids, UA', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'clienttrack', options: { clientName: 'Acme', clientVersion: '2.0.0' } }], server: rec.server });
                await h.ready();
                await h.op({ op: 'load' });
                await h.op({ op: 'load' });
                const h0 = rec.calls[0].fetchdef.headers;
                const h1 = rec.calls[1].fetchdef.headers;
                (0, node_assert_1.strictEqual)(h0['User-Agent'], 'Acme/2.0.0');
                (0, node_assert_1.strictEqual)(h0['X-Client-Id'], h1['X-Client-Id']);
                (0, node_assert_1.ok)(h0['X-Request-Id'] !== h1['X-Request-Id']);
                (0, node_assert_1.strictEqual)(h.client._clienttrack.requests, 2);
            });
            (0, node_test_1.test)('does not clobber a caller User-Agent', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'clienttrack' }], server: rec.server });
                await h.ready();
                await h.op({ op: 'load', headers: { 'User-Agent': 'mine' } });
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.headers['User-Agent'], 'mine');
            });
        });
    // --- paging ---------------------------------------------------------------
    if ((0, harness_1.hasFeature)('paging'))
        (0, node_test_1.describe)('paging', () => {
            (0, node_test_1.test)('stamps page/limit and reads header signals', async () => {
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(200, { items: [1, 2] }, { 'x-next-page': '2', 'x-total-count': '5', 'link': '</w?page=2>; rel="next"' }));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'paging', options: { limit: 2 } }], server: rec.server });
                const res = await h.op({ op: 'list', path: '/w' });
                (0, node_assert_1.ok)(/[?&]page=1(&|$)/.test(rec.calls[0].url));
                (0, node_assert_1.ok)(/[?&]limit=2(&|$)/.test(rec.calls[0].url));
                (0, node_assert_1.strictEqual)(res.result.paging.nextPage, 2);
                (0, node_assert_1.strictEqual)(res.result.paging.totalCount, 5);
                (0, node_assert_1.strictEqual)(res.result.paging.next, '/w?page=2');
            });
            (0, node_test_1.test)('body cursor + explicit cursor request', async () => {
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(200, { nextCursor: 'abc', hasMore: true }));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'paging' }], server: rec.server });
                const res = await h.op({ op: 'list', path: '/w', ctrl: { paging: { cursor: 'xyz' } } });
                (0, node_assert_1.ok)(/[?&]cursor=xyz(&|$)/.test(rec.calls[0].url));
                (0, node_assert_1.strictEqual)(res.result.paging.cursor, 'abc');
                (0, node_assert_1.strictEqual)(res.result.paging.hasMore, true);
            });
        });
    // --- streaming ------------------------------------------------------------
    if ((0, harness_1.hasFeature)('streaming'))
        (0, node_test_1.describe)('streaming', () => {
            (0, node_test_1.test)('streams list items', async () => {
                const clock = (0, harness_1.makeClock)();
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(200, ['a', 'b', 'c']));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'streaming', options: { chunkDelay: 5, sleep: clock.sleep } }], server: rec.server });
                const res = await h.op({ op: 'list', path: '/w' });
                (0, node_assert_1.strictEqual)(res.result.streaming, true);
                const seen = [];
                for await (const item of res.result.stream()) {
                    seen.push(item);
                }
                (0, node_assert_1.deepStrictEqual)(seen, ['a', 'b', 'c']);
                (0, node_assert_1.strictEqual)(clock.time, 15);
            });
            (0, node_test_1.test)('batches with chunkSize', async () => {
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(200, [1, 2, 3, 4, 5]));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'streaming', options: { chunkSize: 2 } }], server: rec.server });
                const res = await h.op({ op: 'list', path: '/w' });
                const batches = [];
                for await (const b of res.result.stream()) {
                    batches.push(b);
                }
                (0, node_assert_1.deepStrictEqual)(batches, [[1, 2], [3, 4], [5]]);
            });
        });
    // --- proxy ----------------------------------------------------------------
    if ((0, harness_1.hasFeature)('proxy'))
        (0, node_test_1.describe)('proxy', () => {
            (0, node_test_1.test)('routes through the proxy and invokes an agent factory', async () => {
                const rec = recordingServer();
                let agentUrl = '';
                const h = (0, harness_1.makeClient)({ features: [{ name: 'proxy', options: { url: 'http://proxy:8080', agent: (u) => { agentUrl = u; return { a: 1 }; } } }], server: rec.server });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.proxy, 'http://proxy:8080');
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.dispatcher.a, 1);
                (0, node_assert_1.strictEqual)(agentUrl, 'http://proxy:8080');
                (0, node_assert_1.strictEqual)(h.client._proxy.routed, 1);
            });
            (0, node_test_1.test)('bypasses noProxy hosts', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'proxy', options: { url: 'http://proxy:8080', noProxy: ['api.test'] } }], server: rec.server, base: 'http://api.test' });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.proxy, undefined);
            });
        });
    // --- edge branches (coverage) ---------------------------------------------
    // Inactive features must no-op; transport features must handle odd
    // responses; the default (non-injected) clocks/timers must run.
    if ((0, harness_1.hasFeature)('netsim'))
        (0, node_test_1.describe)('netsim-edge', () => {
            (0, node_test_1.test)('inactive netsim does not wrap', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { active: false } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
                (0, node_assert_1.strictEqual)(h.client._netsim, undefined);
            });
            (0, node_test_1.test)('no latency option delays nothing (real timer path)', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: {} }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
            (0, node_test_1.test)('real-timer latency actually waits', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'netsim', options: { latency: 15 } }] });
                const t0 = Date.now();
                await h.op({ op: 'load' });
                (0, node_assert_1.ok)(Date.now() - t0 >= 8);
            });
        });
    if ((0, harness_1.hasFeature)('retry'))
        (0, node_test_1.describe)('retry-edge', () => {
            (0, node_test_1.test)('inactive retry does not wrap', async () => {
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(503));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'retry', options: { active: false } }], server: rec.server });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 1);
            });
            (0, node_test_1.test)('retries a null transport result', async () => {
                let n = 0;
                const server = () => { n++; return n < 2 ? null : (0, harness_1.makeResponse)(200, { ok: true }); };
                const h = (0, harness_1.makeClient)({ features: [{ name: 'retry', options: { retries: 3, minDelay: 0 } }], server });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
                (0, node_assert_1.strictEqual)(n, 2);
            });
            (0, node_test_1.test)('non-numeric status is not retryable', async () => {
                const rec = recordingServer((_n) => ({ status: 'weird', json: async () => ({}), headers: { forEach() { } } }));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'retry', options: { retries: 3, minDelay: 0 } }], server: rec.server });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 1);
            });
            (0, node_test_1.test)('Retry-After via plain (non-.get) headers', async () => {
                const clock = (0, harness_1.makeClock)();
                let n = 0;
                const server = () => {
                    n++;
                    return n < 2
                        ? { status: 429, json: async () => undefined, headers: { 'retry-after': '1', forEach() { } } }
                        : (0, harness_1.makeResponse)(200, { ok: true });
                };
                const h = (0, harness_1.makeClient)({ features: [{ name: 'retry', options: { retries: 2, minDelay: 0, jitter: false, sleep: clock.sleep } }], server });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
                (0, node_assert_1.strictEqual)(clock.time, 1000);
            });
            (0, node_test_1.test)('default setTimeout backoff path runs', async () => {
                let n = 0;
                const server = () => { n++; return n < 2 ? (0, harness_1.makeResponse)(503) : (0, harness_1.makeResponse)(200, { ok: true }); };
                const h = (0, harness_1.makeClient)({ features: [{ name: 'retry', options: { retries: 2, minDelay: 1, jitter: false } }], server });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
        });
    if ((0, harness_1.hasFeature)('timeout'))
        (0, node_test_1.describe)('timeout-edge', () => {
            (0, node_test_1.test)('inactive timeout does not wrap', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'timeout', options: { active: false } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
        });
    if ((0, harness_1.hasFeature)('cache'))
        (0, node_test_1.describe)('cache-edge', () => {
            (0, node_test_1.test)('inactive cache does not wrap', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'cache', options: { active: false } }], server: rec.server });
                await h.op({ op: 'load', path: '/x' });
                await h.op({ op: 'load', path: '/x' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 2);
            });
            (0, node_test_1.test)('real Date.now ttl path', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'cache', options: { ttl: 10000 } }], server: rec.server });
                await h.op({ op: 'load', path: '/y' });
                await h.op({ op: 'load', path: '/y' });
                (0, node_assert_1.strictEqual)(rec.calls.length, 1);
            });
        });
    if ((0, harness_1.hasFeature)('ratelimit'))
        (0, node_test_1.describe)('ratelimit-edge', () => {
            (0, node_test_1.test)('inactive ratelimit does not wrap', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'ratelimit', options: { active: false } }] });
                (0, node_assert_1.strictEqual)((await h.op({ op: 'load' })).ok, true);
            });
            (0, node_test_1.test)('real clock throttle path', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'ratelimit', options: { rate: 1000, burst: 1 } }] });
                await h.op({ op: 'load' });
                await h.op({ op: 'load' });
                (0, node_assert_1.ok)((h.client._ratelimit == null ? 0 : h.client._ratelimit.throttled) >= 0);
            });
        });
    if ((0, harness_1.hasFeature)('proxy'))
        (0, node_test_1.describe)('proxy-edge', () => {
            (0, node_test_1.test)('inactive proxy does not wrap', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'proxy', options: { active: false } }], server: rec.server });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.proxy, undefined);
            });
            (0, node_test_1.test)('no url set is a no-op', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'proxy', options: {} }], server: rec.server });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.proxy, undefined);
            });
            (0, node_test_1.test)('fromEnv reads HTTPS_PROXY', async () => {
                const prev = process.env.HTTPS_PROXY;
                process.env.HTTPS_PROXY = 'http://env-proxy:8080';
                try {
                    const rec = recordingServer();
                    const h = (0, harness_1.makeClient)({ features: [{ name: 'proxy', options: { fromEnv: true } }], server: rec.server });
                    await h.op({ op: 'load' });
                    (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.proxy, 'http://env-proxy:8080');
                }
                finally {
                    if (prev == null) {
                        delete process.env.HTTPS_PROXY;
                    }
                    else {
                        process.env.HTTPS_PROXY = prev;
                    }
                }
            });
        });
    if ((0, harness_1.hasFeature)('clienttrack'))
        (0, node_test_1.describe)('clienttrack-edge', () => {
            (0, node_test_1.test)('real id generation without PostConstruct', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'clienttrack' }], server: rec.server });
                // no ready() -> PreRequest lazily creates the session id
                await h.op({ op: 'load' });
                (0, node_assert_1.ok)(null != rec.calls[0].fetchdef.headers['X-Client-Id']);
            });
        });
    if ((0, harness_1.hasFeature)('idempotency'))
        (0, node_test_1.describe)('idempotency-edge', () => {
            (0, node_test_1.test)('real key generation', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'idempotency' }], server: rec.server });
                await h.op({ op: 'create', path: '/w' });
                (0, node_assert_1.ok)(/^[0-9a-f]+$/.test(rec.calls[0].fetchdef.headers['Idempotency-Key']));
            });
        });
    if ((0, harness_1.hasFeature)('telemetry'))
        (0, node_test_1.describe)('telemetry-edge', () => {
            (0, node_test_1.test)('default id generation and no exporter', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'telemetry' }] });
                await h.op({ op: 'load' });
                (0, node_assert_1.ok)(/^t/.test(h.client._telemetry.spans[0].traceId));
            });
        });
    if ((0, harness_1.hasFeature)('streaming'))
        (0, node_test_1.describe)('streaming-edge', () => {
            (0, node_test_1.test)('non-list op is not streamed', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'streaming' }] });
                const res = await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(res.result.streaming, undefined);
            });
            (0, node_test_1.test)('real chunk delay path', async () => {
                const rec = recordingServer((_n) => (0, harness_1.makeResponse)(200, ['a', 'b']));
                const h = (0, harness_1.makeClient)({ features: [{ name: 'streaming', options: { chunkDelay: 1 } }], server: rec.server });
                const res = await h.op({ op: 'list', path: '/w' });
                const seen = [];
                for await (const x of res.result.stream()) {
                    seen.push(x);
                }
                (0, node_assert_1.strictEqual)(seen.length, 2);
            });
        });
    if ((0, harness_1.hasFeature)('paging'))
        (0, node_test_1.describe)('paging-edge', () => {
            (0, node_test_1.test)('non-list op is not paged', async () => {
                const rec = recordingServer();
                const h = (0, harness_1.makeClient)({ features: [{ name: 'paging' }], server: rec.server });
                await h.op({ op: 'load', path: '/w/1' });
                (0, node_assert_1.ok)(!/[?&]page=/.test(rec.calls[0].url));
            });
        });
    if ((0, harness_1.hasFeature)('metrics'))
        (0, node_test_1.describe)('metrics-edge', () => {
            (0, node_test_1.test)('real Date.now timing path', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'metrics' }] });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(h.client._metrics.total.count, 1);
            });
        });
    if ((0, harness_1.hasFeature)('audit'))
        (0, node_test_1.describe)('audit-edge', () => {
            (0, node_test_1.test)('default actor + real Date.now', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'audit' }] });
                await h.op({ op: 'load' });
                (0, node_assert_1.strictEqual)(h.client._audit.records[0].actor, 'anonymous');
            });
        });
    if ((0, harness_1.hasFeature)('debug'))
        (0, node_test_1.describe)('debug-edge', () => {
            (0, node_test_1.test)('default max ring + real Date.now', async () => {
                const h = (0, harness_1.makeClient)({ features: [{ name: 'debug' }] });
                await h.op({ op: 'load' });
                (0, node_assert_1.ok)(h.client._debug.entries[0].durationMs >= 0);
            });
        });
    // --- injectable option branches (coverage) --------------------------------
    // Exercise the injected id/clock callbacks (the default paths are covered
    // elsewhere).
    if ((0, harness_1.hasFeature)('telemetry'))
        (0, node_test_1.test)('telemetry: injected idgen + clock', async () => {
            const h = (0, harness_1.makeClient)({ features: [{ name: 'telemetry', options: { idgen: (k) => k + '-X', now: () => 5 } }] });
            await h.op({ op: 'load' });
            const span = h.client._telemetry.spans[0];
            (0, node_assert_1.strictEqual)(span.traceId, 'trace-X');
            (0, node_assert_1.strictEqual)(span.durationMs, 0);
        });
    if ((0, harness_1.hasFeature)('clienttrack'))
        (0, node_test_1.test)('clienttrack: injected idgen + fixed session', async () => {
            const rec = recordingServer();
            const h = (0, harness_1.makeClient)({ features: [{ name: 'clienttrack', options: { sessionId: 'S1', idgen: (k) => k + '-1' } }], server: rec.server });
            await h.ready();
            await h.op({ op: 'load' });
            (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.headers['X-Client-Id'], 'S1');
            (0, node_assert_1.strictEqual)(rec.calls[0].fetchdef.headers['X-Request-Id'], 'request-1');
        });
    if ((0, harness_1.hasFeature)('audit'))
        (0, node_test_1.test)('audit: injected clock', async () => {
            const h = (0, harness_1.makeClient)({ features: [{ name: 'audit', options: { now: () => 42 } }] });
            await h.op({ op: 'load' });
            (0, node_assert_1.strictEqual)(h.client._audit.records[0].ts, 42);
        });
    if ((0, harness_1.hasFeature)('metrics'))
        (0, node_test_1.test)('metrics: injected clock', async () => {
            let t = 0;
            const h = (0, harness_1.makeClient)({ features: [{ name: 'metrics', options: { now: () => (t += 10) } }] });
            await h.op({ op: 'load' });
            (0, node_assert_1.ok)(h.client._metrics.total.totalMs >= 0);
        });
    if ((0, harness_1.hasFeature)('debug'))
        (0, node_test_1.test)('debug: injected clock + custom redact', async () => {
            const h = (0, harness_1.makeClient)({ features: [{ name: 'debug', options: { now: () => 7, redact: ['x-secret'] } }] });
            await h.op({ op: 'load', headers: { 'x-secret': 'hide', 'x-ok': 'show' } });
            const e = h.client._debug.entries[0];
            (0, node_assert_1.strictEqual)(e.headers['x-secret'], '<redacted>');
            (0, node_assert_1.strictEqual)(e.headers['x-ok'], 'show');
        });
    // --- composition ----------------------------------------------------------
    if ((0, harness_1.hasFeature)('cache') && (0, harness_1.hasFeature)('netsim')) {
        (0, node_test_1.test)('cache + netsim: a hit skips the simulated failure', async () => {
            const h = (0, harness_1.makeClient)({ features: [
                    { name: 'netsim', options: { failEvery: 2 } },
                    { name: 'cache', options: { ttl: 10000 } },
                ] });
            (0, node_assert_1.strictEqual)((await h.op({ op: 'load', path: '/w' })).ok, true);
            (0, node_assert_1.strictEqual)((await h.op({ op: 'load', path: '/w' })).ok, true);
            (0, node_assert_1.strictEqual)(h.client._netsim.calls, 1);
        });
    }
});
//# sourceMappingURL=feature.test.js.map
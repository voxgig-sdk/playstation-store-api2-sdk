"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const live_runner_1 = require("../../live-runner");
const __1 = require("../../..");
const utility_1 = require("../../utility");
// AFTER the imports on purpose: TypeScript hoists `import` above any
// statement in the emitted CommonJS, so a loader placed above them would
// run only after every imported module had already been evaluated - and
// anything reading process.env at module scope would miss these values.
(0, utility_1.loadEnvLocal)(__dirname + '/../../../.env.local');
(0, node_test_1.describe)('ContainerDirect', async () => {
    // Per-test live pacing. Delay is read from sdk-test-control.json's
    // `test.live.delayMs`; only sleeps when PLAYSTATION_STORE_API2_TEST_LIVE=TRUE.
    (0, node_test_1.afterEach)((0, utility_1.liveDelay)('PLAYSTATION_STORE_API2_TEST_LIVE'));
    (0, node_test_1.test)('direct-exists', async () => {
        const sdk = new __1.PlaystationStoreApi2SDK({
            // Concrete base: a live construction must satisfy any server
            // variables a templated base URL declares; overriding base with a
            // literal (as the direct flow tests do) sidesteps the requirement.
            base: 'http://localhost:8080',
            system: { fetch: async () => ({}) }
        });
        (0, node_assert_1.default)('function' === typeof sdk.direct);
        (0, node_assert_1.default)('function' === typeof sdk.prepare);
    });
    (0, node_test_1.test)('direct-load-container', async (t) => {
        if (liveScenariosActive()) {
            t.skip('Covered by live operation scenarios');
            return;
        }
        const setup = directSetup({ id: 'direct01' });
        if ((0, utility_1.maybeSkipControl)(t, 'direct', 'direct-load-container', setup.live))
            return;
        const { client, calls } = setup;
        const params = {};
        const query = {};
        if (setup.live) {
            params.age_limit = "999";
            params.container_id = "STORE-MSF75508-FULLGAMES";
            params.country = "ch";
            params.language = "de";
        }
        else {
            params.age_limit = 'direct01';
            params.container_id = 'direct02';
            params.country = 'direct03';
            params.language = 'direct04';
        }
        const result = await client.direct({
            path: 'container/{country}/{language}/{age_limit}/{container_id}',
            method: 'GET',
            params,
            query,
        });
        if (setup.live) {
            // STRICT live mode: a non-2xx is a real failure - this project owns
            // the server it points at, so there is nothing to be lenient about.
            //
            // What is NOT asserted here is the MOCK's own fixtures. `direct01`
            // is a scripted id and `calls` records the mock transport; neither
            // exists on a live run, so asserting them made strict mode mean
            // "compare the live server against the mock's script" - a suite that
            // could not pass against any real API, including this project's own.
            (0, node_assert_1.default)(result.ok === true, 'Live request failed: HTTP ' + result.status);
            (0, node_assert_1.default)(result.status >= 200 && result.status < 300);
            (0, node_assert_1.default)(null != result.data);
        }
        else {
            (0, node_assert_1.default)(result.ok === true);
            (0, node_assert_1.default)(result.status === 200);
            (0, node_assert_1.default)(null != result.data);
            (0, node_assert_1.default)(result.data.id === 'direct01');
            (0, node_assert_1.default)(calls.length === 1);
            (0, node_assert_1.default)(calls[0].init.method === 'GET');
            (0, node_assert_1.default)(calls[0].url.includes('direct01'));
            (0, node_assert_1.default)(calls[0].url.includes('direct02'));
            (0, node_assert_1.default)(calls[0].url.includes('direct03'));
            (0, node_assert_1.default)(calls[0].url.includes('direct04'));
        }
    });
});
function liveScenariosActive() { return false && process.env.PLAYSTATION_STORE_API2_TEST_LIVE === 'TRUE'; }
function directSetup(mockres) {
    const calls = [];
    const env = (0, utility_1.envOverride)({
        'PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID': {},
        'PLAYSTATION_STORE_API2_TEST_LIVE': 'FALSE',
    });
    const live = 'TRUE' === env.PLAYSTATION_STORE_API2_TEST_LIVE;
    if (live) {
        const transport = (0, live_runner_1.createLiveTransport)();
        // Merged so the generated fields win: sdk-test-control.json's
        // test.client.options adds to the live client, it does not redirect it.
        const client = new __1.PlaystationStoreApi2SDK(Object.assign({}, (0, utility_1.liveClientOptions)(), { system: { fetch: transport.fetch },
        }));
        let idmap = env['PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID'];
        if ('string' === typeof idmap && idmap.startsWith('{')) {
            idmap = JSON.parse(idmap);
        }
        return { client, calls, live, idmap, transport };
    }
    const mockFetch = async (url, init) => {
        calls.push({ url, init });
        return {
            status: 200,
            statusText: 'OK',
            headers: {},
            json: async () => (null != mockres ? mockres : { id: 'direct01' }),
        };
    };
    const client = new __1.PlaystationStoreApi2SDK({
        base: 'http://localhost:8080',
        system: { fetch: mockFetch },
    });
    return { client, calls, live, idmap: {} };
}
// direct() returns the raw response body. List endpoints often wrap the
// array in an envelope (e.g. { data: [...] }, { entities: [...] },
// { pagination, data: [...] }). The test transforms the raw body to
// extract the first array — either the body itself or the first array
// property of an envelope object.
function unwrapListData(data) {
    if (Array.isArray(data))
        return data;
    if (data && 'object' === typeof data) {
        for (const v of Object.values(data)) {
            if (Array.isArray(v))
                return v;
        }
    }
    return null;
}
//# sourceMappingURL=ContainerDirect.test.js.map
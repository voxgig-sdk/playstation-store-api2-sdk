"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const __1 = require("..");
// Network-behaviour simulation over the offline mock transport. The `test`
// feature accepts an optional `net` config so unit tests can exercise slow,
// failing and offline conditions without a live server. These checks drive
// the transport through `direct()`, which needs no entity, so they run for
// every generated SDK regardless of its API shape.
(0, node_test_1.describe)('netsim', () => {
    (0, node_test_1.test)('offline simulation fails the request', async () => {
        const sdk = __1.PlaystationStoreApi2SDK.test({ net: { offline: true } });
        const res = await sdk.direct({ path: '/ping' });
        (0, node_assert_1.equal)(res.ok, false, 'offline network must fail the call');
    });
    (0, node_test_1.test)('failStatus simulation surfaces the error status', async () => {
        const sdk = __1.PlaystationStoreApi2SDK.test({ net: { failTimes: 1, failStatus: 503 } });
        const res = await sdk.direct({ path: '/ping' });
        (0, node_assert_1.equal)(res.ok, false);
        (0, node_assert_1.equal)(res.status, 503, 'simulated failure status is surfaced');
    });
    (0, node_test_1.test)('latency simulation delays the request', async () => {
        const delay = 60;
        const sdk = __1.PlaystationStoreApi2SDK.test({ net: { latency: delay } });
        const start = Date.now();
        await sdk.direct({ path: '/ping' });
        const elapsed = Date.now() - start;
        // Generous lower bound to stay robust on slow CI.
        (0, node_assert_1.ok)(elapsed >= delay - 25, `expected >= ${delay - 25}ms latency, got ${elapsed}ms`);
    });
    (0, node_test_1.test)('a plain test SDK still works with no net simulation', async () => {
        const sdk = __1.PlaystationStoreApi2SDK.test();
        (0, node_assert_1.equal)(null !== sdk, true);
    });
});
//# sourceMappingURL=netsim.test.js.map
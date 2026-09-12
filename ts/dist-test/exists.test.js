"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const __1 = require("..");
(0, node_test_1.describe)('exists', async () => {
    // NOT async, and the assertion is deliberate.
    //
    // PlaystationStoreApi2SDK.test() is synchronous — it returns the client, not a promise
    // — so the `await` here was a no-op. Worse, it hid the weakness of the
    // assertion: `null !== testsdk` is trivially true for ANY non-null value,
    // including the promise an `await` would have unwrapped. The test could not
    // have failed short of test() returning null.
    //
    // instanceof is the real check: it fails if test() ever starts returning a
    // promise, or anything other than a client.
    (0, node_test_1.test)('test-mode', () => {
        const testsdk = __1.PlaystationStoreApi2SDK.test();
        (0, node_assert_1.equal)(testsdk instanceof __1.PlaystationStoreApi2SDK, true, 'PlaystationStoreApi2SDK.test() must return a client synchronously');
    });
});
//# sourceMappingURL=exists.test.js.map
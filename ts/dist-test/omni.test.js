"use strict";
// Smoke tests for the vendored omni runner itself: a runner that cannot
// FAIL a bad entry would turn every corpus suite vacuously green, so pin
// the failure paths, not just the happy one.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const __1 = require("..");
const omni_1 = require("./omni");
// A minimal in-memory spec: no fixture file, no OMNI block (lenient v0,
// like the shared corpus).
const SPEC = {
    primary: {
        smoke: {
            basic: {
                set: [
                    { in: 1, out: 2 },
                    { in: 41, out: 42 },
                ],
            },
            bad: {
                set: [
                    { in: 1, out: 999 },
                ],
            },
            err: {
                set: [
                    { in: 0, err: 'zero refused' },
                ],
            },
        },
    },
};
const inc = (n) => {
    if (0 === n) {
        throw new Error('smoke: zero refused');
    }
    return n + 1;
};
(0, node_test_1.describe)('omni', () => {
    (0, node_test_1.test)('runset passes a correct subject', async () => {
        const runner = await (0, omni_1.makeRunner)(SPEC, __1.SDK.test());
        const R = await runner('smoke');
        await R.runset(R.spec.basic, inc);
    });
    (0, node_test_1.test)('runset FAILS a wrong result, with OmniError', async () => {
        const runner = await (0, omni_1.makeRunner)(SPEC, __1.SDK.test());
        const R = await runner('smoke');
        await node_assert_1.default.rejects(() => R.runset(R.spec.bad, inc), (err) => {
            node_assert_1.default.equal(err.name, 'OmniError');
            node_assert_1.default.ok(err instanceof omni_1.OmniError);
            node_assert_1.default.match(err.message, /result mismatch/);
            return true;
        });
    });
    (0, node_test_1.test)('an expected error is matched, an unexpected one fails', async () => {
        const runner = await (0, omni_1.makeRunner)(SPEC, __1.SDK.test());
        const R = await runner('smoke');
        await R.runset(R.spec.err, inc);
        await node_assert_1.default.rejects(() => R.runset(R.spec.err, (n) => n), (err) => {
            node_assert_1.default.equal(err.name, 'OmniError');
            node_assert_1.default.match(err.message, /expected error did not occur/);
            return true;
        });
    });
});
//# sourceMappingURL=omni.test.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const __1 = require("../..");
(0, node_test_1.describe)('Custom', () => {
    (0, node_test_1.test)('basic', async () => {
        const client = __1.PlaystationStoreApi2SDK.test({}, {
            apikey: 'APIKEY01',
            // NOTE: original utility.options must remain in place.
            utility: {
                auth: () => ({ util: 'AUTH' }),
                body: () => ({ util: 'BODY' }),
                contextify: () => ({ util: 'CONTEXTIFY' }),
                done: () => ({ util: 'DONE' }),
                error: () => ({ util: 'ERROR' }),
                findparam: () => ({ util: 'FINDPARAM' }),
                fullurl: () => ({ util: 'FULLURL' }),
                headers: () => ({ util: 'HEADERS' }),
                method: () => ({ util: 'METHOD' }),
                operator: () => ({ util: 'OPERATOR' }),
                params: () => ({ util: 'PARAMS' }),
                query: () => ({ util: 'QUERY' }),
                reqform: () => ({ util: 'REQFORM' }),
                request: () => ({ util: 'REQUEST' }),
                resbasic: () => ({ util: 'RESBASIC' }),
                resbody: () => ({ util: 'RESBODY' }),
                resform: () => ({ util: 'RESFORM' }),
                resheaders: () => ({ util: 'RESHEADERS' }),
                response: () => ({ util: 'RESPONSE' }),
                result: () => ({ util: 'RESULT' }),
                spec: () => ({ util: 'SPEC' }),
            }
        });
        const u = client.utility();
        (0, node_assert_1.equal)(u.auth().util, 'AUTH');
        (0, node_assert_1.equal)(u.body().util, 'BODY');
        (0, node_assert_1.equal)(u.contextify().util, 'CONTEXTIFY');
        (0, node_assert_1.equal)(u.done().util, 'DONE');
        (0, node_assert_1.equal)(u.error().util, 'ERROR');
        (0, node_assert_1.equal)(u.findparam().util, 'FINDPARAM');
        (0, node_assert_1.equal)(u.fullurl().util, 'FULLURL');
        (0, node_assert_1.equal)(u.headers().util, 'HEADERS');
        (0, node_assert_1.equal)(u.method().util, 'METHOD');
        (0, node_assert_1.equal)(u.operator().util, 'OPERATOR');
        (0, node_assert_1.equal)(u.params().util, 'PARAMS');
        (0, node_assert_1.equal)(u.query().util, 'QUERY');
        (0, node_assert_1.equal)(u.reqform().util, 'REQFORM');
        (0, node_assert_1.equal)(u.resbasic().util, 'RESBASIC');
        (0, node_assert_1.equal)(u.resbody().util, 'RESBODY');
        (0, node_assert_1.equal)(u.resform().util, 'RESFORM');
        (0, node_assert_1.equal)(u.resheaders().util, 'RESHEADERS');
        (0, node_assert_1.equal)(u.response().util, 'RESPONSE');
        (0, node_assert_1.equal)(u.result().util, 'RESULT');
        (0, node_assert_1.equal)(u.spec().util, 'SPEC');
    });
});
//# sourceMappingURL=Custom.test.js.map
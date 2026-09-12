"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRequest = makeRequest;
const types_1 = require("../types");
async function makeRequest(ctx) {
    // PreRequest feature hook has already provided a result.
    if (ctx.out.request) {
        return ctx.out.request;
    }
    const spec = ctx.spec;
    const utility = ctx.utility;
    const fetcher = utility.fetcher;
    const makeFetchDef = utility.makeFetchDef;
    let response = new types_1.Response({});
    let result = new types_1.Result({});
    ctx.result = result;
    if (null == spec) {
        return ctx.error('request_no_spec', 'Expected context spec property to be defined.');
    }
    try {
        const fetchdef = makeFetchDef(ctx);
        if (fetchdef instanceof Error) {
            throw fetchdef;
        }
        if (ctx.ctrl.explain) {
            ctx.ctrl.explain.fetchdef = fetchdef;
        }
        spec.step = 'prerequest';
        // TODO: see js code, use `native` prop here
        const fetched = await fetcher(ctx, fetchdef.url, fetchdef);
        if (null == fetched) {
            response = new types_1.Response({ err: ctx.error('request_no_response', 'response: undefined') });
        }
        else if (fetched instanceof Error) {
            response = new types_1.Response({ err: fetched });
        }
        else {
            response = new types_1.Response(fetched);
        }
    }
    catch (err) {
        response.err = err;
    }
    spec.step = 'postrequest';
    ctx.response = response;
    return response;
}
//# sourceMappingURL=MakeRequestUtility.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeFetchDef = makeFetchDef;
const types_1 = require("../types");
function makeFetchDef(ctx) {
    const spec = ctx.spec;
    const utility = ctx.utility;
    const makeUrl = utility.makeUrl;
    const struct = utility.struct;
    const jsonify = struct.jsonify;
    if (null == spec) {
        return ctx.error('fetchdef_no_spec', 'Expected context spec property to be defined.');
    }
    if (null == ctx.result) {
        ctx.result = new types_1.Result({});
    }
    spec.step = 'prepare';
    const url = makeUrl(ctx);
    if (url instanceof Error) {
        return url;
    }
    spec.url = url;
    const fetchdef = {
        url,
        method: spec.method,
        headers: spec.headers,
    };
    if (null != spec.body) {
        fetchdef.body =
            'object' === typeof spec.body ? jsonify(spec.body) : spec.body;
    }
    return fetchdef;
}
//# sourceMappingURL=MakeFetchDefUtility.js.map
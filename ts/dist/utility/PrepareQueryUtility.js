"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareQuery = prepareQuery;
function prepareQuery(ctx) {
    const utility = ctx.utility;
    const struct = utility.struct;
    const items = struct.items;
    const point = ctx.point;
    let params = point.params;
    let reqmatch = ctx.reqmatch;
    params = params || [];
    reqmatch = reqmatch || {};
    const out = {};
    for (let [key, val] of items(reqmatch)) {
        if (null != val && !params.includes(key)) {
            out[key] = val;
        }
    }
    return out;
}
//# sourceMappingURL=PrepareQueryUtility.js.map
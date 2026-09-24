"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareParams = prepareParams;
function prepareParams(ctx) {
    const utility = ctx.utility;
    const findparam = utility.param;
    const point = ctx.point;
    let params = point.args.params;
    params = params || [];
    let out = {};
    for (let pd of params) {
        let val = findparam(ctx, pd);
        if (null != val) {
            out[pd.name] = val;
        }
    }
    return out;
}
//# sourceMappingURL=PrepareParamsUtility.js.map
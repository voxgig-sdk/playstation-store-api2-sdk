"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareParams = prepareParams;
function prepareParams(ctx) {
    const utility = ctx.utility;
    const findparam = utility.param;
    // const struct = utility.struct
    // const validate = struct.validate
    const point = ctx.point;
    let params = point.args.params;
    // let reqmatch = ctx.reqmatch
    params = params || [];
    // reqmatch = reqmatch || {}
    let out = {};
    for (let pd of params) {
        let val = findparam(ctx, pd);
        if (null != val) {
            out[pd.name] = val;
        }
    }
    // TODO: review
    // out = validate(out, point.validate.params)
    return out;
}
//# sourceMappingURL=PrepareParamsUtility.js.map
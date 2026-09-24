"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clean = clean;
// Clean request data by partially hiding sensitive values.
function clean(ctx, val) {
    const options = ctx.options;
    const cleankeyre = options?.__derived__?.clean?.keyre;
    const hintsize = 4;
    return val;
}
//# sourceMappingURL=CleanUtility.js.map
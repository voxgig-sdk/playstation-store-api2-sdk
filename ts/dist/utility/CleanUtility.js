"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clean = clean;
// Clean request data by partially hiding sensitive values.
function clean(ctx, val) {
    const options = ctx.options;
    const cleankeyre = options?.__derived__?.clean?.keyre;
    const hintsize = 4;
    /*
    if (null != cleankeyre) {
      val = walk(clone(val), (key: any, subval: any) => {
        if (cleankeyre.exec(key) && 'string' === typeof subval) {
          const len = size(subval)
          const hint = (hintsize * 4) < len ? slice(subval, 0, hintsize) : ''
          subval = pad(hint, len, '*')
        }
        return subval
      })
    }
    */
    return val;
}
//# sourceMappingURL=CleanUtility.js.map
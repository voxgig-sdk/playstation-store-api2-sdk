"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.done = done;
const CleanUtility_1 = require("./CleanUtility");
function done(ctx) {
    const error = ctx.utility.makeError;
    const delprop = ctx.utility.struct.delprop;
    if (ctx.ctrl.explain) {
        ctx.ctrl.explain = (0, CleanUtility_1.clean)(ctx, ctx.ctrl.explain);
        delprop(ctx.ctrl.explain.result, 'err');
    }
    if (ctx.result && ctx.result.ok) {
        return ctx.result.resdata;
    }
    return error(ctx);
}
//# sourceMappingURL=DoneUtility.js.map
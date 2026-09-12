"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeError = makeError;
const types_1 = require("../types");
const CleanUtility_1 = require("./CleanUtility");
const StructUtility_1 = require("./StructUtility");
function makeError(ctx, err) {
    ctx = ctx || {};
    const op = ctx.op || {};
    op.name = op.name || 'unknown operation';
    const result = ctx.result || new types_1.Result({});
    result.ok = false;
    const reserr = result.err;
    err = undefined === err ? reserr : err;
    err = err || ctx.error('unknown', 'unknown error');
    const errmsg = err.message || 'unknown error';
    // TODO: project name should come from config
    // avoids spurious changes between template and generated utility
    // applies for all utility files
    const msg = 'PlaystationStoreApi2SDK: ' + op.name + ': ' + errmsg;
    err.message = (0, CleanUtility_1.clean)(ctx, msg);
    if (result.err) {
        (0, StructUtility_1.delprop)(result, 'err');
    }
    const spec = ctx.spec || {};
    if (ctx.ctrl.explain) {
        ctx.ctrl.explain.err = {
            ...(0, StructUtility_1.clone)({ err }).err,
            message: err.message,
            stack: err.stack,
        };
    }
    err.result = (0, CleanUtility_1.clean)(ctx, result);
    err.spec = (0, CleanUtility_1.clean)(ctx, spec);
    // Promote the HTTP status to the top level, so a consumer can branch on
    // `err.status` / `err.notFound` instead of reaching into `err.result`.
    err.status = null == result.status ? -1 : result.status;
    ctx.ctrl.err = err;
    // Fire PreUnexpected so observability features (metrics, telemetry, audit,
    // debug) close/record error paths that never reach PreDone (e.g. a PrePoint
    // rbac short-circuit). Fires after ctx.ctrl.err is set so hooks can read the
    // error; features guard against double-recording when PreDone already fired.
    if (null != ctx.client && null != ctx.utility &&
        'function' === typeof ctx.utility.featureHook) {
        ctx.utility.featureHook(ctx, 'PreUnexpected');
    }
    // TODO: model option to return instead
    if (false === ctx.ctrl.throw) {
        return result.resdata;
    }
    else {
        throw err;
    }
}
//# sourceMappingURL=MakeErrorUtility.js.map
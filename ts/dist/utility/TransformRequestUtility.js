"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRequest = transformRequest;
function transformRequest(ctx) {
    const spec = ctx.spec;
    const utility = ctx.utility;
    const point = ctx.point;
    const isfunc = utility.struct.isfunc;
    const transform = utility.struct.transform;
    if (spec) {
        spec.step = 'reqform';
    }
    try {
        const reqform = point.transform.req;
        const reqdata = isfunc(reqform) ? reqform(ctx) : transform({
            reqdata: ctx.reqdata
        }, reqform);
        return stripAction(reqdata);
    }
    catch (err) {
        return utility.makeError(ctx, err);
    }
}
function stripAction(reqdata) {
    if (null == reqdata || 'object' !== typeof reqdata || Array.isArray(reqdata)) {
        return reqdata;
    }
    if (!Object.prototype.hasOwnProperty.call(reqdata, '$action')) {
        return reqdata;
    }
    const body = {};
    for (const key of Object.keys(reqdata)) {
        if ('$action' === key) {
            continue;
        }
        if ('__proto__' === key) {
            Object.defineProperty(body, key, {
                value: reqdata[key],
                enumerable: true,
                writable: true,
                configurable: true,
            });
        }
        else {
            body[key] = reqdata[key];
        }
    }
    return body;
}
//# sourceMappingURL=TransformRequestUtility.js.map
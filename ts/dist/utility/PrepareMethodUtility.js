"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareMethod = prepareMethod;
function prepareMethod(ctx) {
    const op = ctx.op;
    const opname = op.name;
    let key = opname;
    const methodMap = {
        create: 'POST',
        update: 'PUT',
        load: 'GET',
        list: 'GET',
        remove: 'DELETE',
        patch: 'PATCH',
    };
    // The API definition is authoritative: a POST-only or PATCH-based API
    // exposes `update` as POST or PATCH, not the PUT the op name implies.
    // Only fall back to the op-name convention when the point has no method.
    const method = ctx.point?.method;
    if (null != method && '' !== method) {
        return method.toUpperCase();
    }
    return methodMap[key];
}
//# sourceMappingURL=PrepareMethodUtility.js.map
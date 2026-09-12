"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareHeaders = prepareHeaders;
function prepareHeaders(ctx) {
    const struct = ctx.utility.struct;
    const clone = struct.clone;
    const getprop = struct.getprop;
    const client = ctx.client;
    const options = client.options();
    let out = clone(getprop(options, 'headers', {}));
    return out;
}
//# sourceMappingURL=PrepareHeadersUtility.js.map
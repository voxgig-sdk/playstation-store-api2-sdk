"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultHeaders = resultHeaders;
function resultHeaders(ctx) {
    const response = ctx.response;
    const result = ctx.result;
    if (result) {
        if (response && response.headers && response.headers.forEach) {
            const headers = {};
            response.headers.forEach((v, k) => headers[k] = v);
            result.headers = headers;
        }
        else {
            result.headers = {};
        }
    }
    return result;
}
//# sourceMappingURL=ResultHeadersUtility.js.map
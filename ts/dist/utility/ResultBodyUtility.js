"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultBody = resultBody;
async function resultBody(ctx) {
    const response = ctx.response;
    const result = ctx.result;
    if (result) {
        if (response && response.json && null != response.body) {
            const json = await response.json();
            result.body = json;
        }
    }
    return result;
}
//# sourceMappingURL=ResultBodyUtility.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultBasic = resultBasic;
function resultBasic(ctx) {
    const utility = ctx.utility;
    const struct = utility.struct;
    const getprop = struct.getprop;
    const response = ctx.response;
    const result = ctx.result;
    if (null != result && null != response) {
        result.status = getprop(response, 'status', -1);
        result.statusText = getprop(response, 'statusText', 'no-status');
        // TODO: use spec!
        if (400 <= result.status) {
            const msg = 'request: ' + result.status + ': ' + result.statusText;
            if (result.err) {
                const prevmsg = null == result.err.message ? '' : result.err.message;
                result.err.message = prevmsg + ': ' + msg;
            }
            else {
                result.err = ctx.error('request_status', msg);
            }
        }
        else if (response.err) {
            result.err = response.err;
        }
    }
    return result;
}
//# sourceMappingURL=ResultBasicUtility.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Result = void 0;
const StructUtility_1 = require("./utility/StructUtility");
class Result {
    ok;
    status;
    statusText;
    headers;
    body;
    err;
    resdata;
    resmatch;
    constructor(resmap) {
        this.ok = (0, StructUtility_1.getprop)(resmap, 'ok', false);
        this.status = (0, StructUtility_1.getprop)(resmap, 'status', -1);
        this.statusText = (0, StructUtility_1.getprop)(resmap, 'statusText', '');
        this.headers = (0, StructUtility_1.getprop)(resmap, 'headers', {});
        this.body = (0, StructUtility_1.getprop)(resmap, 'body');
        this.err = (0, StructUtility_1.getprop)(resmap, 'err');
        this.resdata = (0, StructUtility_1.getprop)(resmap, 'resdata');
        this.resmatch = (0, StructUtility_1.getprop)(resmap, 'resmatch');
    }
}
exports.Result = Result;
//# sourceMappingURL=Result.js.map
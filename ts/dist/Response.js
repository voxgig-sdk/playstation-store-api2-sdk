"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Response = void 0;
const StructUtility_1 = require("./utility/StructUtility");
class Response {
    status;
    statusText;
    headers;
    json;
    err;
    body;
    constructor(resmap) {
        this.status = (0, StructUtility_1.getprop)(resmap, 'status', -1);
        this.statusText = (0, StructUtility_1.getprop)(resmap, 'statusText', '');
        this.headers = (0, StructUtility_1.getprop)(resmap, 'headers');
        this.json = resmap.json ? resmap.json.bind(resmap) : async () => undefined;
        this.body = (0, StructUtility_1.getprop)(resmap, 'body');
        this.err = (0, StructUtility_1.getprop)(resmap, 'err');
    }
}
exports.Response = Response;
//# sourceMappingURL=Response.js.map
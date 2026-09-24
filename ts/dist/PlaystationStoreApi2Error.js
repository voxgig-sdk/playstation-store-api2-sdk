"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaystationStoreApi2Error = void 0;
class PlaystationStoreApi2Error extends Error {
    isPlaystationStoreApi2Error = true;
    sdk = 'PlaystationStoreApi2';
    code;
    ctx;
    status = -1;
    // `err.notFound` rather than a magic number at every call site.
    get notFound() { return 404 === this.status; }
    constructor(code, msg, ctx) {
        super(msg);
        this.code = code;
        this.ctx = ctx;
    }
}
exports.PlaystationStoreApi2Error = PlaystationStoreApi2Error;
//# sourceMappingURL=PlaystationStoreApi2Error.js.map
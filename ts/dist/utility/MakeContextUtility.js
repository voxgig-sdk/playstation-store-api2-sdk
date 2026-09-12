"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeContext = makeContext;
const types_1 = require("../types");
function makeContext(ctxmap, basectx) {
    const ctx = new types_1.Context(ctxmap, basectx);
    return ctx;
}
//# sourceMappingURL=MakeContextUtility.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preparePath = preparePath;
function preparePath(ctx) {
    const join = ctx.utility.struct.join;
    const point = ctx.point;
    const path = join(point.parts, '/', true);
    return path;
}
//# sourceMappingURL=PreparePathUtility.js.map
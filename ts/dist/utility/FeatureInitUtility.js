"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureInit = featureInit;
function featureInit(ctx, f) {
    const fopts = ctx.options.feature[f.name] || {};
    if (true === fopts.active) {
        f.init(ctx, fopts);
    }
}
//# sourceMappingURL=FeatureInitUtility.js.map
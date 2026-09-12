"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Control = void 0;
const StructUtility_1 = require("./utility/StructUtility");
class Control {
    throw;
    err;
    explain;
    constructor(ctrlmap) {
        this.throw = (0, StructUtility_1.getprop)(ctrlmap, 'throw');
        this.err = (0, StructUtility_1.getprop)(ctrlmap, 'err');
        this.explain = (0, StructUtility_1.getprop)(ctrlmap, 'explain');
    }
}
exports.Control = Control;
//# sourceMappingURL=Control.js.map
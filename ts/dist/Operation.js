"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Operation = void 0;
const StructUtility_1 = require("./utility/StructUtility");
class Operation {
    entity;
    name;
    input;
    points;
    constructor(opmap) {
        this.entity = (0, StructUtility_1.getprop)(opmap, 'entity', '_');
        this.name = (0, StructUtility_1.getprop)(opmap, 'name', '_');
        this.input = (0, StructUtility_1.getprop)(opmap, 'input', '_');
        this.points = (0, StructUtility_1.getprop)(opmap, 'points', []);
    }
}
exports.Operation = Operation;
//# sourceMappingURL=Operation.js.map
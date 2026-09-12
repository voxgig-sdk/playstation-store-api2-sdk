"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Point = void 0;
const StructUtility_1 = require("./utility/StructUtility");
class Point {
    args;
    // Transport this point speaks: 'http' (default) or 'graphql'. GraphQL
    // points carry their operation document in `graphql` and address the
    // single endpoint, so method is always POST and parts is empty.
    kind;
    graphql;
    rename;
    method;
    orig;
    parts;
    params;
    select;
    active;
    relations;
    alias;
    transform;
    constructor(altmap) {
        this.args = (0, StructUtility_1.getprop)(altmap, 'args', { params: [] });
        this.kind = (0, StructUtility_1.getprop)(altmap, 'kind', 'http');
        this.graphql = (0, StructUtility_1.getprop)(altmap, 'graphql');
        this.rename = (0, StructUtility_1.getprop)(altmap, 'rename', { params: {} });
        this.method = (0, StructUtility_1.getprop)(altmap, 'method', '');
        this.orig = (0, StructUtility_1.getprop)(altmap, 'orig', '');
        this.parts = (0, StructUtility_1.getprop)(altmap, 'parts', []);
        this.params = (0, StructUtility_1.getprop)(altmap, 'params', []);
        this.select = (0, StructUtility_1.getprop)(altmap, 'select');
        // Absent in config means ACTIVE: emission drops `active: true` as a default
        // (sdkgen L0), so only an explicit `active: false` turns a point off.
        this.active = (0, StructUtility_1.getprop)(altmap, 'active', true);
        this.relations = (0, StructUtility_1.getprop)(altmap, 'relations', []);
        this.alias = (0, StructUtility_1.getprop)(altmap, 'alias', {});
        this.transform = (0, StructUtility_1.getprop)(altmap, 'transform', { req: undefined, res: undefined });
    }
}
exports.Point = Point;
//# sourceMappingURL=Point.js.map
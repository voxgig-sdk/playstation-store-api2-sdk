"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spec = void 0;
const StructUtility_1 = require("./utility/StructUtility");
class Spec {
    parts;
    headers;
    alias;
    base;
    prefix;
    suffix;
    params;
    query;
    step;
    method;
    body;
    url;
    path;
    constructor(specmap) {
        this.parts = (0, StructUtility_1.getprop)(specmap, 'parts', []);
        this.headers = (0, StructUtility_1.getprop)(specmap, 'headers', {});
        this.alias = (0, StructUtility_1.getprop)(specmap, 'alias', {});
        this.base = (0, StructUtility_1.getprop)(specmap, 'base', '');
        this.prefix = (0, StructUtility_1.getprop)(specmap, 'prefix', '');
        this.suffix = (0, StructUtility_1.getprop)(specmap, 'suffix', '');
        this.params = (0, StructUtility_1.getprop)(specmap, 'params', {});
        this.query = (0, StructUtility_1.getprop)(specmap, 'query', {});
        this.step = (0, StructUtility_1.getprop)(specmap, 'step', '');
        this.method = (0, StructUtility_1.getprop)(specmap, 'method', 'GET');
        this.body = (0, StructUtility_1.getprop)(specmap, 'body');
        this.url = (0, StructUtility_1.getprop)(specmap, 'url');
        this.path = (0, StructUtility_1.getprop)(specmap, 'path');
    }
}
exports.Spec = Spec;
//# sourceMappingURL=Spec.js.map
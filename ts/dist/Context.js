"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
const node_util_1 = require("node:util");
const PlaystationStoreApi2Error_1 = require("./PlaystationStoreApi2Error");
const StructUtility_1 = require("./utility/StructUtility");
const Operation_1 = require("./Operation");
// TODO: move to own file
class Context {
    id = 'C' + ('' + Math.random()).substring(2, 10);
    // Store the output of each operation step.
    out = {};
    // Store for the current operation.
    current = new WeakMap();
    ctrl = {};
    meta = {};
    client;
    utility;
    op;
    point;
    config;
    entopts;
    options;
    opmap;
    response;
    result;
    spec;
    data;
    reqdata;
    match;
    reqmatch;
    entity;
    // Shared persistent store.
    shared;
    constructor(ctxmap, basectx) {
        this.client = (0, StructUtility_1.getprop)(ctxmap, 'client', (0, StructUtility_1.getprop)(basectx, 'client'));
        this.utility = (0, StructUtility_1.getprop)(ctxmap, 'utility', (0, StructUtility_1.getprop)(basectx, 'utility'));
        this.ctrl = (0, StructUtility_1.getprop)(ctxmap, 'ctrl', (0, StructUtility_1.getprop)(basectx, 'ctrl', this.ctrl));
        this.meta = (0, StructUtility_1.getprop)(ctxmap, 'meta', (0, StructUtility_1.getprop)(basectx, 'meta', this.meta));
        this.config = (0, StructUtility_1.getprop)(ctxmap, 'config', (0, StructUtility_1.getprop)(basectx, 'config'));
        this.entopts = (0, StructUtility_1.getprop)(ctxmap, 'entopts', (0, StructUtility_1.getprop)(basectx, 'entopts'));
        this.options = (0, StructUtility_1.getprop)(ctxmap, 'options', (0, StructUtility_1.getprop)(basectx, 'options'));
        this.entity = (0, StructUtility_1.getprop)(ctxmap, 'entity', (0, StructUtility_1.getprop)(basectx, 'entity'));
        this.shared = (0, StructUtility_1.getprop)(ctxmap, 'shared', (0, StructUtility_1.getprop)(basectx, 'shared'));
        this.opmap = (0, StructUtility_1.getprop)(ctxmap, 'opmap', (0, StructUtility_1.getprop)(basectx, 'opmap'));
        this.data = (0, StructUtility_1.getprop)(ctxmap, 'data', {});
        this.reqdata = (0, StructUtility_1.getprop)(ctxmap, 'reqdata', {});
        this.match = (0, StructUtility_1.getprop)(ctxmap, 'match', {});
        this.reqmatch = (0, StructUtility_1.getprop)(ctxmap, 'reqmatch', {});
        this.point = (0, StructUtility_1.getprop)(ctxmap, 'point', (0, StructUtility_1.getprop)(basectx, 'point'));
        this.spec = (0, StructUtility_1.getprop)(ctxmap, 'spec', (0, StructUtility_1.getprop)(basectx, 'spec'));
        this.result = (0, StructUtility_1.getprop)(ctxmap, 'result', (0, StructUtility_1.getprop)(basectx, 'result'));
        this.response = (0, StructUtility_1.getprop)(ctxmap, 'response', (0, StructUtility_1.getprop)(basectx, 'response'));
        const opname = (0, StructUtility_1.getprop)(ctxmap, 'opname');
        this.op = this.resolveOp(opname);
    }
    resolveOp(opname) {
        // Cache key is `<entity>:<opname>` so two entities with the same op
        // (e.g. both have a "list") get distinct cached Operations. Keying on
        // opname alone caused the first-resolved entity's points to be served
        // to every subsequent entity's call.
        const entname = (0, StructUtility_1.getprop)(this.entity, 'name', '');
        const cacheKey = entname + ':' + opname;
        let op = (0, StructUtility_1.getprop)(this.opmap, cacheKey);
        if (null == op && null != opname) {
            const opcfg = (0, StructUtility_1.getpath)(this.config, ['entity', entname, 'op', opname]);
            let input = 'match';
            if ('update' === opname || 'create' === opname) {
                input = 'data';
            }
            op = new Operation_1.Operation({
                entity: entname,
                name: opname,
                input,
                points: (0, StructUtility_1.getprop)(opcfg, 'points', [])
            });
            (0, StructUtility_1.setprop)(this.opmap, cacheKey, op);
        }
        return op;
    }
    error(code, msg) {
        return new PlaystationStoreApi2Error_1.PlaystationStoreApi2Error(code, msg, this);
    }
    toJSON() {
        return {
            id: this.id,
            op: this.op,
            spec: this.spec,
            entity: this.entity,
            result: this.result,
            response: this.response,
            meta: this.meta,
        };
    }
    toString() {
        return 'Context ' + this.utility?.struct.jsonify(this.toJSON());
    }
    [node_util_1.inspect.custom]() {
        return this.toString();
    }
}
exports.Context = Context;
//# sourceMappingURL=Context.js.map
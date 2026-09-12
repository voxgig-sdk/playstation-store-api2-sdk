"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerEntity = void 0;
const PlaystationStoreApi2EntityBase_1 = require("../PlaystationStoreApi2EntityBase");
// TODO: needs Entity superclass
class ContainerEntity extends PlaystationStoreApi2EntityBase_1.PlaystationStoreApi2EntityBase {
    constructor(client, entopts) {
        super(client, entopts);
        this.name = 'container';
        this.name_ = 'container';
        this.Name = 'Container';
    }
    make() {
        return new ContainerEntity(this._client, this.entopts());
    }
    async load(reqmatch, ctrl) {
        const utility = this._utility;
        const { makeContext, done, 
        // The registry name is `makeError`; `error` is the local alias.
        makeError: error, featureHook, makePoint, makeRequest, makeResponse, makeResult, makeSpec, } = utility;
        let fres = undefined;
        let ctx = makeContext({
            opname: 'load',
            ctrl,
            match: this._match,
            data: this._data,
            reqmatch
        }, this._entctx);
        try {
            fres = featureHook(ctx, 'PrePoint');
            if (fres instanceof Promise) {
                await fres;
            }
            ctx.out.point = makePoint(ctx);
            if (ctx.out.point instanceof Error) {
                return error(ctx, ctx.out.point);
            }
            fres = featureHook(ctx, 'PreSpec');
            if (fres instanceof Promise) {
                await fres;
            }
            ctx.out.spec = makeSpec(ctx);
            if (ctx.out.spec instanceof Error) {
                return error(ctx, ctx.out.spec);
            }
            fres = featureHook(ctx, 'PreRequest');
            if (fres instanceof Promise) {
                await fres;
            }
            ctx.out.request = await makeRequest(ctx);
            if (ctx.out.request instanceof Error) {
                return error(ctx, ctx.out.request);
            }
            fres = featureHook(ctx, 'PreResponse');
            if (fres instanceof Promise) {
                await fres;
            }
            ctx.out.response = await makeResponse(ctx);
            if (ctx.out.response instanceof Error) {
                return error(ctx, ctx.out.response);
            }
            fres = featureHook(ctx, 'PreResult');
            if (fres instanceof Promise) {
                await fres;
            }
            ctx.out.result = await makeResult(ctx);
            if (ctx.out.result instanceof Error) {
                return error(ctx, ctx.out.result);
            }
            fres = featureHook(ctx, 'PreDone');
            if (fres instanceof Promise) {
                await fres;
            }
            if (null != ctx.result) {
                if (null != ctx.result.resmatch) {
                    this._match = ctx.result.resmatch;
                }
                if (null != ctx.result.resdata) {
                    this._data = ctx.result.resdata;
                }
            }
            const out = done(ctx);
            // An operation resolves to the ENTITY, not the raw data — the record
            // has just been absorbed into this instance and is reached through
            // data(). `done` still runs: it completes the pipeline and raises on
            // failure, and when throwing is disabled it hands back the error
            // payload, which passes through unchanged. See AGENTS.md "Entity
            // operations return ENTITIES".
            return (ctx.result && ctx.result.ok) ? this : out;
        }
        catch (err) {
            fres = featureHook(ctx, 'PreUnexpected');
            if (fres instanceof Promise) {
                await fres;
            }
            err = this._unexpected(ctx, err);
            if (err) {
                throw err;
            }
            else {
                // Off-happy-path (throw disabled): typed as any so the method's
                // Promise<Container> return stays clean under strict null checks.
                return undefined;
            }
        }
    }
}
exports.ContainerEntity = ContainerEntity;
//# sourceMappingURL=ContainerEntity.js.map
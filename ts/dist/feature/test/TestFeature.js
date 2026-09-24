"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestFeature = void 0;
exports.ownIdField = ownIdField;
exports.mintId = mintId;
const BaseFeature_1 = require("../base/BaseFeature");
const S_NOT_FOUND = 'Not found';
// The `%04x%04x%04x%04x` every other target mints, so the id's shape does not
// depend on which language answered.
function mintId() {
    let out = '';
    for (let i = 0; i < 4; i++) {
        out += ((Math.random() * 0x10000) | 0).toString(16).padStart(4, '0');
    }
    return out;
}
function ownIdField(config, getpath, entityName) {
    let fallback = '';
    for (const opname of ['load', 'remove', 'update']) {
        const points = getpath(config, ['entity', entityName, 'op', opname, 'points']) || [];
        const canonical = points.filter((pt) => null == (pt && pt.select && pt.select['$action']));
        const use = 0 < canonical.length ? canonical : points;
        let best = use[0];
        for (const pt of use) {
            if (null == pt || null == pt.parts || null == best || null == best.parts)
                continue;
            const ptterm = 0 < pt.parts.length && String(pt.parts[pt.parts.length - 1]).startsWith('{');
            const bestterm = 0 < best.parts.length && String(best.parts[best.parts.length - 1]).startsWith('{');
            if (ptterm !== bestterm ? ptterm : pt.parts.length < best.parts.length)
                best = pt;
        }
        const parts = (best && best.parts) || [];
        const lastPart = 0 < parts.length ? String(parts[parts.length - 1]) : '';
        if (lastPart.startsWith('{'))
            return lastPart.slice(1, -1);
        // No path param at all (or the route ends in a literal, e.g.
        // /orgs/{org}/private-registries/public-key): a single required QUERY
        // param can still be the record's own key (e.g. GET /result?trace_id=).
        const query = (best && best.args && best.args.query) || [];
        const reqdQuery = query.filter((q) => false !== q.reqd);
        if (1 === reqdQuery.length)
            return String(reqdQuery[0].name);
        // The last path parameter of a literal-terminal route is remembered as
        // a LAST RESORT, but not returned yet — see below.
        if ('' === fallback) {
            for (let i = parts.length - 1; 0 <= i; i--) {
                const part = String(parts[i]);
                if (part.startsWith('{')) {
                    fallback = part.slice(1, -1);
                    break;
                }
            }
        }
    }
    if ('' !== fallback) {
        return fallback;
    }
    return 'id';
}
class TestFeature extends BaseFeature_1.BaseFeature {
    version = '0.0.1';
    name = 'test';
    active = true;
    _client;
    _options;
    init(ctx, options) {
        this._client = ctx.client;
        this._options = options;
        const struct = ctx.utility.struct;
        const walk = struct.walk;
        const size = struct.size;
        const setprop = struct.setprop;
        const entity = this._options.entity;
        this._client._mode = 'test';
        const getpath = struct.getpath;
        // Ensure entity ids are correct.
        walk(entity, (k, v, _parent, path) => {
            if (2 === size(path)) {
                setprop(v, 'id', k);
                const idField = ownIdField(ctx.config, getpath, String(path[0]));
                if ('id' !== idField) {
                    setprop(v, idField, k);
                }
            }
            return v;
        });
        const self = this;
        function testFetcher(ctx, _fullurl, _fetchdef) {
            const struct = ctx.utility.struct;
            const param = ctx.utility.param;
            const getprop = struct.getprop;
            const clone = struct.clone;
            const merge = struct.merge;
            const getelem = struct.getelem;
            const select = struct.select;
            const delprop = struct.delprop;
            const getdef = struct.getdef;
            function envelope(data) {
                const restf = getprop(getprop(ctx.point, 'transform', {}), 'res');
                if (null == data || 'string' !== typeof restf) {
                    return data;
                }
                const m = restf.match(/^`body\.(.+)`$/);
                if (null == m) {
                    return data;
                }
                let out = data;
                const segs = m[1].split('.');
                for (let i = segs.length - 1; 0 <= i; i--) {
                    out = { [segs[i]]: out };
                }
                return out;
            }
            function respond(status, data, res) {
                const payload = envelope(data);
                const out = merge([
                    {
                        status,
                        statusText: 'OK',
                        json: async () => payload,
                        body: 'not-used',
                    },
                    getdef(res, {})
                ]);
                const headers = getprop(out, 'headers', {});
                // JS specific iterator.
                out.headers = {
                    forEach(callback) {
                        Object.keys(headers).forEach((key) => {
                            callback(headers[key], key, this);
                        });
                    }
                };
                return out;
            }
            const op = ctx.op;
            const entmap = getprop(entity, op.entity, {});
            if ('load' === op.name) {
                const args = self.buildArgs(ctx, op, ctx.reqmatch);
                const found = select(entmap, args);
                const ent = getelem(found, 0);
                if (null == ent) {
                    return respond(404, undefined, { statusText: S_NOT_FOUND });
                }
                else {
                    delprop(ent, '$KEY');
                    const out = clone(ent);
                    return respond(200, out);
                }
            }
            else if ('list' === op.name) {
                const args = self.buildArgs(ctx, op, ctx.reqmatch);
                const found = select(entmap, args);
                if (null == found) {
                    return respond(404, undefined, { statusText: S_NOT_FOUND });
                }
                else {
                    found.map((ent) => delprop(ent, '$KEY'));
                    const out = clone(found);
                    return respond(200, out);
                }
            }
            else if ('update' === op.name) {
                const args = self.buildArgs(ctx, op, ctx.reqdata);
                const found = select(entmap, args);
                const ent = getelem(found, 0);
                if (null == ent) {
                    // update miss: 404, never another record
                    return respond(404, undefined, { statusText: S_NOT_FOUND });
                }
                else {
                    merge([ent, (ctx.reqdata || {})]);
                    delprop(ent, '$KEY');
                    const out = clone(ent);
                    return respond(200, out);
                }
            }
            else if ('remove' === op.name) {
                const args = self.buildArgs(ctx, op, ctx.reqmatch);
                const found = select(entmap, args);
                const ent = getelem(found, 0);
                // Remove only the first matched entity. If nothing matches,
                // succeed as a no-op rather than erroring.
                if (null != ent) {
                    delprop(entmap, getprop(ent, 'id'));
                }
                return respond(200);
            }
            else if ('create' === op.name) {
                const args = self.buildArgs(ctx, op, ctx.reqdata);
                let id = param(ctx, 'id');
                if (null == id) {
                    id = mintId();
                }
                const ent = clone(ctx.reqdata);
                setprop(ent, 'id', id);
                // A record created during the run needs the same real-key seeding
                // the initial walk gives seed data (see ownIdField above) — without
                // it, only `id` is set, and a load by the entity's own key right
                // after create (recordKey !== 'id') finds nothing.
                const idField = ownIdField(ctx.config, struct.getpath, getprop(op, 'entity'));
                if ('id' !== idField && null == getprop(ent, idField)) {
                    setprop(ent, idField, id);
                }
                setprop(entmap, id, ent);
                delprop(ent, '$KEY');
                const out = clone(ent);
                return respond(200, out);
            }
            return respond(404, undefined, { statusText: 'Unknown operation' });
        }
        // Optional network behaviour simulation over the mock transport. Enable
        // per test via `SDK.test({ net: { latency, failTimes, ... } })`. When
        // `net` is absent the mock behaves exactly as before (no wrapping), so
        // existing generated tests are unaffected.
        const net = this._options.net;
        ctx.utility.fetcher = (null == net) ? testFetcher : this.makeNetsim(net, testFetcher);
    }
    // Wrap a transport with simulated network conditions: latency (fixed or
    // {min,max}), a budget of first-N failures (`failTimes` -> `failStatus`),
    // first-N connection errors (`errorTimes`), or a hard `offline` outage.
    // Counter-driven, so simulations are deterministic across a test.
    makeNetsim(net, inner) {
        const self = this;
        self._netcalls = 0;
        function pickLatency() {
            const l = net.latency;
            if (null == l) {
                return 0;
            }
            if ('number' === typeof l) {
                return l < 0 ? 0 : l;
            }
            const min = l.min | 0;
            const max = null == l.max ? min : l.max | 0;
            return max <= min ? min : min + ((max - min) >> 1);
        }
        function sleep(ms) {
            if (null == ms || 0 >= ms) {
                return Promise.resolve();
            }
            if ('function' === typeof net.sleep) {
                return Promise.resolve(net.sleep(ms));
            }
            return new Promise((r) => setTimeout(r, ms));
        }
        return async function netsimFetcher(ctx, url, fetchdef) {
            self._netcalls++;
            const call = self._netcalls;
            if (true === net.offline) {
                await sleep(pickLatency());
                return ctx.error('netsim_offline', 'Simulated network offline (URL was: "' + url + '")');
            }
            if (call <= (net.errorTimes | 0)) {
                await sleep(pickLatency());
                return ctx.error('netsim_conn', 'Simulated connection error (call ' + call + ')');
            }
            if (call <= (net.failTimes | 0)) {
                await sleep(pickLatency());
                const status = null == net.failStatus ? 503 : net.failStatus;
                return {
                    status,
                    statusText: 'Simulated Failure',
                    body: 'not-used',
                    json: async () => undefined,
                    headers: { forEach(_cb) { }, get(_k) { return undefined; } },
                };
            }
            await sleep(pickLatency());
            return inner(ctx, url, fetchdef);
        };
    }
    buildArgs(ctx, op, args) {
        const struct = ctx.utility.struct;
        const param = ctx.utility.param;
        const getprop = struct.getprop;
        const keysof = struct.keysof;
        const getpath = struct.getpath;
        const getelem = struct.getelem;
        const select = struct.select;
        const transform = struct.transform;
        const isempty = struct.isempty;
        const opname = getprop(op, 'name');
        const points = getpath(ctx.config, [
            'entity', getprop(ctx.entity, 'name'), 'op', opname, 'points'
        ]) || [];
        // Pick the entity's own endpoint, not a cross-reference from another
        // resource that also returns it — the same rule makePoint falls back to,
        // so the seed-data query is built from the endpoint the request will
        // actually be sent to: a terminal `{id}` marks a record route, and
        // failing that the shallower path wins.
        const isterm = (pt) => {
            const parts = pt.parts;
            const last = 0 < parts.length ? parts[parts.length - 1] : '';
            return 'string' === typeof last && 0 === last.indexOf('{');
        };
        let point = getelem(points, 0);
        for (let i = 1; i < points.length; i++) {
            const cand = getelem(points, i);
            if (isterm(cand) !== isterm(point) ? isterm(cand) :
                cand.parts.length < point.parts.length) {
                point = cand;
            }
        }
        // Path AND query: a path-only read misses a query-addressed record
        // (e.g. GET /result?trace_id=), which has no path param at all.
        const reqdParams = transform(select(getpath(point, ['args', 'params']), { reqd: true }), ['`$EACH`', '', '`$KEY.name`']);
        const reqdQuery = transform(select(getpath(point, ['args', 'query']), { reqd: true }), ['`$EACH`', '', '`$KEY.name`']);
        const reqd = [...(reqdParams || []), ...(reqdQuery || [])];
        const qand = [];
        const q = { '`$AND`': qand };
        const idfrom = getpath(ctx.config, [
            'entity', getprop(ctx.entity, 'name'), 'id', 'from'
        ]) || {};
        const nest = (path, value) => {
            const keys = String(path).split('.');
            let out = value;
            for (let i = keys.length - 1; 0 <= i; i--) {
                out = { [keys[i]]: out };
            }
            return out;
        };
        const match = ctx.match || {};
        const names = [...keysof(args)];
        if (null == getprop(args, 'id')) {
            for (const part of (getpath(ctx.config, [
                'entity', getprop(ctx.entity, 'name'), 'id', 'parts'
            ]) || [])) {
                const pname = String(part);
                if (!names.includes(pname) && null != getprop(match, pname)) {
                    names.push(pname);
                }
            }
        }
        for (let k of names) {
            if ('id' === k || !isempty(select(reqd, k))) {
                const v = param(ctx, k);
                const ka = getprop(op.alias, k);
                let qor = [{ [k]: v }];
                if (null != ka) {
                    qor.push({ [ka]: v });
                }
                // An ALTERNATIVE, never a replacement: the parameter name still
                // matches a record that happens to carry it flat, so a seed written
                // either way is found. `$OR` is what makes that safe.
                const kf = getprop(idfrom, k);
                if (null != kf && k !== kf) {
                    qor.push(nest(kf, v));
                }
                qor = { '`$OR`': qor };
                qand.push(qor);
            }
        }
        if (ctx.ctrl.explain) {
            ctx.ctrl.explain.test = { query: q };
        }
        return q;
    }
}
exports.TestFeature = TestFeature;
//# sourceMappingURL=TestFeature.js.map
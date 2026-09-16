"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLiveEntity = runLiveEntity;
const strict_1 = __importDefault(require("node:assert/strict"));
const live_contract_1 = require("./live-contract");
const live_runner_1 = require("./live-runner");
const utility_1 = require("./utility");
// The offline flow keeps its deterministic fixture assertions. Live flows
// resolve real prerequisites per operation and collect failures until done.
async function runLiveEntity(setup, entity, flow, accessor) {
    const { client, transport } = setup;
    const steps = flow.step || [];
    const created = new Map();
    const listed = [];
    const marks = new Map();
    const idField = entity.id?.field || 'id';
    const copy = (value) => JSON.parse(JSON.stringify(value ?? {}));
    const hasCreate = steps.some(step => step.op === 'create');
    const report = await (0, live_runner_1.runLiveSteps)(steps.map((step, index) => {
        const ref = step.input?.ref || entity.name + '_ref01';
        const op = step.op;
        const excluded = (0, utility_1.isControlSkipped)('entityOp', entity.name + '.' + op, 'live');
        return {
            id: entity.name + '.' + op + '.' + index,
            cleanup: op === 'remove' || (step.valid || []).some((v) => v.apply === 'ItemNotExists'),
            excluded: excluded.skip ? excluded.reason || 'Excluded by test control' : undefined,
            run: async (context) => {
                transport.enter(context);
                const points = entity.op?.[op]?.points || [];
                if (!points.length)
                    throw new live_runner_1.LiveBlocked('No modelled operation point');
                const record = created.get(ref);
                // A failed create must not turn a later update/remove into a write
                // against an arbitrary record found by a list operation.
                if ((op === 'update' || op === 'remove') && hasCreate && !record) {
                    throw new live_runner_1.LiveBlocked('Create did not provide a usable resource');
                }
                if (op === 'remove' && !record)
                    throw new live_runner_1.LiveBlocked('No resource created by this run');
                if (op === 'remove' && !entity.id)
                    throw new live_runner_1.LiveBlocked('No modelled resource identity for cleanup');
                if (record && ['update', 'remove'].includes(op) && entity.id &&
                    null == (record[idField] ?? record.id)) {
                    throw new live_runner_1.LiveBlocked('Created resource has no usable identity');
                }
                let input = op === 'create'
                    ? copy(setup.data.new?.[entity.name]?.[ref]) : {};
                for (const [name, binding] of Object.entries({ ...step.match, ...step.data })) {
                    const value = setup.idmap[binding] ?? setup.idmap[name];
                    if (undefined !== value)
                        input[name] = value;
                }
                const loaded = record || (op === 'load' ? listed[0] : undefined);
                if (loaded && ['load', 'update', 'remove'].includes(op)) {
                    const id = loaded[idField] ?? loaded.id;
                    if (undefined !== id)
                        input.id = id;
                }
                // A nested route needing a parent id must not hide an available
                // parameter-free route for the same operation. Use the first viable
                // candidate; the SDK still performs its normal route selection.
                let resolved;
                let selected;
                const missing = new Set();
                for (const point of points) {
                    if (point.select?.$action !== input.$action)
                        continue;
                    const candidate = { ...input };
                    let viable = true;
                    const params = point.args?.params || [];
                    const query = (point.args?.query || []).filter((arg) => arg.reqd);
                    for (const arg of [...params, ...query]) {
                        if (undefined !== candidate[arg.name] && null !== candidate[arg.name])
                            continue;
                        const key = arg.name === 'id' ? entity.name + '01' : arg.name.replace(/_id$/, '') + '01';
                        const value = setup.idmap[key] ?? setup.idmap[arg.name] ?? loaded?.[arg.name] ?? arg.example;
                        if (undefined !== value && null !== value)
                            candidate[arg.name] = value;
                        else if (arg.reqd !== false) {
                            viable = false;
                            missing.add(arg.name);
                        }
                    }
                    if (viable) {
                        resolved = candidate;
                        selected = point;
                        break;
                    }
                }
                if (!resolved)
                    throw new live_runner_1.LiveBlocked('No usable route; missing arguments: ' + [...missing].join(', '));
                input = resolved;
                if (op === 'create' && selected.contract) {
                    const facts = JSON.parse(selected.contract.json);
                    const request = (0, live_contract_1.requestContract)(facts);
                    if (request.schema)
                        input = { ...(0, live_contract_1.synthesizeInput)(request.schema, facts.live?.input ?? request.example) };
                    else if (facts.protocol === 'http')
                        input = {};
                    for (const arg of selected.args?.params || [])
                        if (resolved[arg.name] !== undefined)
                            input[arg.name] = resolved[arg.name];
                }
                let intendedMark;
                if (op === 'update') {
                    for (const spec of step.spec || []) {
                        if (spec.apply === 'TextFieldMark' && step.input?.textfield) {
                            const mark = { name: step.input.textfield, value: spec.def.mark + '_' + setup.now };
                            input[mark.name] = mark.value;
                            intendedMark = mark;
                        }
                    }
                }
                // A fresh entity prevents state left by a failed operation from
                // changing the request for the next independent operation.
                const result = await client[accessor]()[op](input);
                if (intendedMark)
                    marks.set(ref, intendedMark);
                if (op === 'list') {
                    (0, strict_1.default)(Array.isArray(result), 'Expected a list of entity instances');
                    const data = result.map((item) => {
                        strict_1.default.equal(typeof item?.data, 'function');
                        return item.data();
                    });
                    listed.splice(0, listed.length, ...data);
                    context.publish(data);
                    for (const validation of step.valid || []) {
                        const previous = created.get(validation.def?.ref);
                        const id = previous?.[idField] ?? previous?.id;
                        if (undefined === id)
                            continue;
                        const found = data.some((item) => (item?.[idField] ?? item?.id) === id);
                        if (validation.apply === 'ItemExists')
                            (0, strict_1.default)(found, 'Created resource missing from list');
                        if (validation.apply === 'ItemNotExists')
                            (0, strict_1.default)(!found, 'Removed resource still in list');
                    }
                }
                else {
                    strict_1.default.equal(typeof result?.data, 'function', 'Expected an entity instance');
                    const data = result.data();
                    (0, strict_1.default)(null != data, 'Expected operation data');
                    // Publish before assertion checks: cleanup still needs the id
                    // when the server created a resource with incorrect field values.
                    if (op === 'create')
                        created.set(ref, data);
                    context.publish(data);
                    if (op === 'create' && entity.id)
                        (0, strict_1.default)(null != (data[idField] ?? data.id), 'Missing created identity');
                    if (['load', 'update'].includes(op) && input.id != null && entity.id) {
                        strict_1.default.equal(data[idField] ?? data.id, input.id, 'Response identity mismatch');
                    }
                    const mark = marks.get(ref);
                    if (mark && ['update', 'load'].includes(op)) {
                        strict_1.default.equal(data[mark.name], mark.value, 'Updated field mismatch');
                    }
                }
            },
        };
    }), {
        delayMs: (0, utility_1.liveDelayMs)(),
        report: result => console.log('LIVE STEP ' + JSON.stringify(result)),
    });
    console.log('LIVE SUMMARY ' + JSON.stringify({ entity: entity.name, ...report }));
    (0, live_runner_1.assertLiveReport)(report);
}
//# sourceMappingURL=live-entity.js.map
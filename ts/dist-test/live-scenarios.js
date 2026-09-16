"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRecipe = resolveRecipe;
exports.recipeNeeds = recipeNeeds;
exports.runLiveScenarios = runLiveScenarios;
const strict_1 = __importDefault(require("node:assert/strict"));
const live_runner_1 = require("./live-runner");
const live_contract_1 = require("./live-contract");
const utility_1 = require("./utility");
const at = (value, path) => (path || '').split('.').filter(Boolean).reduce((v, k) => v?.[k], value);
function resolveRecipe(recipe, values) {
    if (Array.isArray(recipe))
        return recipe.map(v => resolveRecipe(v, values));
    if (recipe && typeof recipe === 'object') {
        if (recipe.from) {
            if (!values.has(recipe.from))
                throw new live_runner_1.LiveBlocked('Missing recipe output: ' + recipe.from);
            let value = values.get(recipe.from);
            if (recipe.where) {
                if (!Array.isArray(value))
                    throw new live_runner_1.LiveBlocked('Discovery output is not a list');
                value = value.find((item) => Object.entries(recipe.where).every(([k, v]) => at(item, k) === v) &&
                    (!recipe.related || (values.get(recipe.related.from) || []).some((other) => at(item, recipe.related.local) === at(other, recipe.related.foreign) &&
                        Object.entries(recipe.related.where || {}).every(([k, v]) => at(other, k) === v))));
            }
            value = at(value, recipe.path);
            if (value === undefined || value === null)
                throw new live_runner_1.LiveBlocked('Discovery found no compatible value');
            return value;
        }
        return Object.fromEntries(Object.entries(recipe).map(([k, v]) => [k, resolveRecipe(v, values)]));
    }
    return recipe;
}
function recipeNeeds(value) {
    if (!value || typeof value !== 'object')
        return [];
    return [...new Set([...(typeof value.from === 'string' ? [value.from] : []), ...Object.values(value).flatMap(recipeNeeds)])];
}
async function runLiveScenarios(SDK, plan, envPrefix, liveDefaults = {}) {
    const transport = (0, live_runner_1.createLiveTransport)();
    const steps = plan.map(point => {
        const hint = point.facts.live || {};
        const control = (0, utility_1.isControlSkipped)('entityOp', point.entity + '.' + point.op, 'live');
        return { role: hint.auth || (point.facts.security?.length === 0 || point.facts.securitySource === 'unspecified' ? 'public' : 'account'), retention: hint.retention, id: hint.id || point.id, needs: [...new Set([...(hint.needs || []), ...recipeNeeds(hint.input), ...recipeNeeds(hint.credential), ...recipeNeeds(hint.assert)])],
            cleanup: !!hint.cleanup,
            excluded: control.skip ? control.reason || 'Excluded by test control' : hint.excluded,
            run: async (ctx) => {
                transport.enter(ctx);
                if (point.contractVersion && point.contractVersion !== 1)
                    throw new live_runner_1.LiveBlocked('Unsupported operation contract version');
                if (point.op === 'remove' || hint.cleanup) {
                    const owned = recipeNeeds(hint.input).some(id => plan.some(source => (source.facts.live?.id || source.id) === id && source.entity === point.entity && source.op === 'create'));
                    if (!owned)
                        throw new live_runner_1.LiveBlocked('Cleanup input is not bound to a resource created by this run');
                }
                if (!point.reachable)
                    throw new live_runner_1.LiveBlocked('Point selector is indistinguishable; add a guide action');
                const request = (0, live_contract_1.requestContract)(point.facts);
                const explicit = hint.input === undefined ? request.example : resolveRecipe(hint.input, ctx.values);
                let input = request.schema ? (0, live_contract_1.synthesizeInput)(request.schema, explicit) : explicit ?? {};
                for (const kind of ['params', 'query', 'header', 'cookie'])
                    for (const arg of point.args?.[kind] || []) {
                        if (arg.reqd && input[arg.name] === undefined) {
                            if (arg.example === undefined)
                                throw new live_runner_1.LiveBlocked('Missing required argument: ' + arg.name);
                            input[arg.name] = arg.example;
                        }
                    }
                const role = hint.auth || (point.facts.security?.length === 0 || point.facts.securitySource === 'unspecified' ? 'public' : 'account');
                let apikey = role === 'public' ? null : role === 'issued' ? resolveRecipe(hint.credential, ctx.values) : process.env[envPrefix + '_APIKEY'];
                if (role === 'issued' && (typeof apikey !== 'string' || !apikey))
                    throw new live_runner_1.LiveBlocked('Issued credential unavailable');
                let wire;
                let wireSchema;
                const options = (0, utility_1.liveClientOptions)();
                const client = new SDK({ ...options, ...liveDefaults, apikey,
                    feature: { ...options.feature, test: { active: false }, retry: { active: false },
                        secrets: { ...options.feature?.secrets, active: role === 'account' && (!apikey || options.feature?.secrets?.active === true) } },
                    system: { ...options.system, fetch: async (url, init) => {
                            const headers = new Headers(init?.headers);
                            if (role === 'public')
                                (0, strict_1.default)(!headers.has('authorization'), 'Public request carries authentication');
                            else if (!headers.get('authorization'))
                                throw new live_runner_1.LiveBlocked('Credential unavailable for ' + role + ' request');
                            const response = await transport.fetch(url, { ...init, redirect: 'error' });
                            const expectedPath = point.path.replace(/\{([^}]+)\}/g, (_, name) => encodeURIComponent(input[point.rename?.param?.[name] || name] ?? input[name]));
                            if (point.kind === 'graphql') {
                                const payload = JSON.parse(init.body);
                                strict_1.default.equal(payload.query, point.graphql.doc, 'Entity selected wrong GraphQL operation');
                            }
                            else
                                strict_1.default.equal(new URL(String(url)).pathname, expectedPath, 'Entity selected wrong route');
                            strict_1.default.equal(init?.method || 'GET', point.method);
                            (0, strict_1.default)(response.status >= 200 && response.status < 300, 'Unsuccessful HTTP response');
                            if (point.kind === 'graphql')
                                wire = await response.clone().json();
                            const def = point.facts.responses?.[response.status] || point.facts.responses?.[String(response.status)[0] + 'XX'] || point.facts.responses?.default;
                            if (point.facts.responses && !def)
                                throw new Error('Undeclared response status');
                            if (def) {
                                const schema = def.content?.['application/json']?.schema ?? def.schema;
                                if (schema && response.status !== 204) {
                                    wireSchema = schema;
                                    wire = await response.clone().json();
                                }
                            }
                            return response;
                        } } });
                if (point.action)
                    input = { ...input, $action: point.action };
                (0, strict_1.default)(JSON.stringify(input).length <= 1024 * 1024, 'Request exceeds test payload limit');
                const result = await client[point.accessor]()[point.op](input);
                const data = Array.isArray(result) ? result.map(item => { strict_1.default.equal(typeof item?.data, 'function'); return item.data(); }) : (strict_1.default.equal(typeof result?.data, 'function'), result.data());
                ctx.publish(data);
                if (wireSchema)
                    (0, live_contract_1.validateContract)(wireSchema, wire, 'response');
                if (Array.isArray(wire?.errors) && wire.errors.length)
                    throw new Error('GraphQL operation reported errors');
                if (wire?.success === false)
                    throw new Error('API reported unsuccessful operation');
                const checks = resolveRecipe(hint.assert || {}, ctx.values);
                for (const [path, expected] of Object.entries(checks.equal || {}))
                    strict_1.default.deepEqual(at(data, path), expected);
                for (const path of checks.nonempty || [])
                    (0, strict_1.default)(at(data, path)?.length > 0, 'Empty required output');
                if (checks.vectors) {
                    const vectors = at(data, checks.vectors.path);
                    (0, strict_1.default)(Array.isArray(vectors) && vectors.length === checks.vectors.count);
                    for (const vector of vectors)
                        (0, strict_1.default)(Array.isArray(vector) && vector.length === checks.vectors.dimension && vector.every((n) => typeof n === 'number' && Number.isFinite(n)), 'Invalid vector shape');
                }
            } };
    });
    const report = await (0, live_runner_1.runLiveSteps)(steps, { delayMs: (0, utility_1.liveDelayMs)(), report: result => console.log('LIVE STEP ' + JSON.stringify(result)) });
    console.log('LIVE SUMMARY ' + JSON.stringify(report));
    (0, live_runner_1.assertLiveReport)(report);
    return report;
}
//# sourceMappingURL=live-scenarios.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const index_1 = require("../utility/index");
const FEATURES = Object.keys((() => {
    try {
        return JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', index_1.TEST_JSON_FILE), 'utf8')).feature || {};
    }
    catch (e) {
        return {};
    }
})()).sort();
// A scripted transport built from a case's `res` list. Responses are consumed
// in order and the last one repeats, so a case that does not care how many
// attempts happen need only declare one.
function scriptedFetcher(res) {
    let n = -1;
    return async function (_ctx, _url, _fetchdef) {
        n++;
        const spec = res[n < res.length ? n : res.length - 1] || {};
        if (true === spec.throw) {
            throw new Error('scripted transport failure');
        }
        const headers = spec.headers || {};
        const status = null == spec.status ? 200 : spec.status;
        return {
            status,
            statusText: status < 400 ? 'OK' : 'ERR',
            body: 'not-used',
            json: async () => (undefined === spec.body ? {} : spec.body),
            headers: {
                get(key) {
                    const lower = String(key).toLowerCase();
                    for (const k of Object.keys(headers)) {
                        if (k.toLowerCase() === lower) {
                            return headers[k];
                        }
                    }
                    return undefined;
                },
                forEach(cb) { Object.keys(headers).forEach((k) => cb(headers[k], k, this)); },
            },
        };
    };
}
function makeClient(kase) {
    return new index_1.SDK({
        test: { active: true },
        feature: kase.feature,
        utility: { fetcher: scriptedFetcher(kase.res || [{ status: 200, body: {} }]) },
    });
}
function candidates(client) {
    const entities = client._rootctx.config.entity || {};
    const accessor = {};
    for (const m of Object.getOwnPropertyNames(Object.getPrototypeOf(client))) {
        if (!/^[A-Z]/.test(m) || 'function' !== typeof client[m]) {
            continue;
        }
        let inst;
        try {
            inst = client[m]();
        }
        catch (e) {
            continue;
        }
        if (null != inst && 'string' === typeof inst.name && null != entities[inst.name]) {
            accessor[inst.name] = m;
        }
    }
    const out = [];
    for (const entity of Object.keys(entities).sort()) {
        if (null == accessor[entity]) {
            continue;
        }
        for (const op of Object.keys(entities[entity].op || {}).sort()) {
            out.push({ key: entity + '.' + op, accessor: accessor[entity], entity, op });
        }
    }
    const SAFE = { list: 0, load: 1 };
    return out.sort((a, b) => (SAFE[a.op] ?? 2) - (SAFE[b.op] ?? 2) || a.key.localeCompare(b.key));
}
// Pick operations the corpus can drive, by DRIVING them: an op is usable when
// it completes against a plain 200 with no feature active. Declared ops are
// not all callable with no arguments (a required path parameter, a body), and
// a case that failed for that reason would look like a feature defect.
async function usableOps(want) {
    const picked = [];
    for (const cand of candidates(makeClient({}))) {
        const client = makeClient({});
        try {
            await client[cand.accessor]()[cand.op]({}, {});
        }
        catch (e) {
            continue;
        }
        picked.push(cand);
        if (want <= picked.length) {
            break;
        }
    }
    return picked;
}
// Replace #OP1/#OP2 throughout a case, keys included.
function resolve(node, tokens) {
    if ('string' === typeof node) {
        let s = node;
        for (const t of Object.keys(tokens)) {
            s = s.split(t).join(tokens[t]);
        }
        return s;
    }
    if (Array.isArray(node)) {
        return node.map((n) => resolve(n, tokens));
    }
    if (null != node && 'object' === typeof node) {
        const out = {};
        for (const k of Object.keys(node)) {
            out[resolve(k, tokens)] = resolve(node[k], tokens);
        }
        return out;
    }
    return node;
}
// Which #OPn tokens a case uses. A case wanting more operations than this SDK
// has is skipped rather than failed.
function tokensUsed(kase) {
    const m = JSON.stringify(kase).match(/#OP(\d+)/g) || [];
    return m.reduce((max, t) => Math.max(max, Number(t.slice(3))), 0);
}
// Assert that `actual` contains `expect`, recursively. Cases assert only the
// fields they are about, so a full deepStrictEqual would force every case to
// restate the whole record.
function subset(actual, expect, path) {
    if (null != expect && 'object' === typeof expect && !Array.isArray(expect)) {
        for (const k of Object.keys(expect)) {
            (0, node_assert_1.ok)(null != actual, `${path}.${k}: nothing at ${path}`);
            subset(actual[k], expect[k], `${path}.${k}`);
        }
        return;
    }
    (0, node_assert_1.deepStrictEqual)(actual, expect, path);
}
(0, node_test_1.describe)('FeatureCorpus', () => {
    let corpus;
    let ops = [];
    let byKey = {};
    (0, node_test_1.before)(async () => {
        corpus = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', index_1.TEST_JSON_FILE), 'utf8'));
        ops = await usableOps(2);
        byKey = {};
        for (const o of ops) {
            byKey[o.key] = o;
        }
    });
    (0, node_test_1.test)('the corpus carries a feature section', (t) => {
        if (null == corpus.feature) {
            return t.skip('this project\'s test.json has no `feature` section - recompile the ' +
                'corpus (create-sdkgen .sdk/test/feature/) to run these cases');
        }
    });
    // At least one operation, or every case below would skip and the whole
    // suite would report green having run nothing.
    (0, node_test_1.test)('this SDK has an operation the corpus can drive', () => {
        (0, node_assert_1.ok)(0 < ops.length, 'no declared operation completed against a plain 200 — the corpus ' +
            'cannot exercise a feature without one');
    });
    for (const name of FEATURES) {
        (0, node_test_1.test)(name, async (t) => {
            const section = corpus.feature?.[name];
            if (null == section) {
                return t.skip(`no corpus section for ${name}`);
            }
            const probe = makeClient({});
            if (!probe._rootctx.config.hasFeature(name)) {
                t.diagnostic(`feature.${name}: inert (this SDK does not generate the feature)`);
                return t.skip(`this SDK was generated without the ${name} feature`);
            }
            const cases = section.basic?.set || [];
            (0, node_assert_1.ok)(0 < cases.length, `corpus section feature.${name} ran ZERO cases — a renamed section ` +
                `or an emptied fixture must fail loudly, not pass silently`);
            let ran = 0;
            for (const raw of cases) {
                const need = tokensUsed(raw);
                if (ops.length < need) {
                    t.diagnostic(`skip "${raw.name}": needs ${need} operations, this SDK offers ${ops.length}`);
                    continue;
                }
                const tokens = {};
                for (let i = 0; i < need; i++) {
                    tokens['#OP' + (i + 1)] = ops[i].key;
                }
                const kase = resolve(raw, tokens);
                const client = makeClient(kase);
                for (const step of (kase.op || [])) {
                    const ref = byKey[step.op];
                    (0, node_assert_1.ok)(null != ref, `${kase.name}: no operation ${step.op}`);
                    try {
                        await client[ref.accessor]()[ref.op]({}, step.ctrl || {});
                        (0, node_assert_1.ok)(null == step.err, `${kase.name}: ${step.op} was expected to fail, and did not`);
                    }
                    catch (err) {
                        if (null == step.err) {
                            throw err;
                        }
                        if ('string' === typeof step.err) {
                            (0, node_assert_1.deepStrictEqual)(err.code, step.err, `${kase.name}: wrong error code`);
                        }
                    }
                }
                subset(client[`_${name}`], kase.out, `${kase.name}: _${name}`);
                ran++;
            }
            (0, node_assert_1.ok)(0 < ran, `every feature.${name} case was skipped`);
            // Say how many ran. A partial run is legitimate (an SDK with one
            // operation skips the cases needing two) but it should be visible
            // rather than inferred from a green tick - and it is the one line
            // sdkgen's end-to-end lane reads, in the same wording, from every
            // language's runner.
            t.diagnostic(`feature.${name}: ran ${ran} of ${cases.length} ` +
                `case(s) against ${ops.length} operation(s)`);
        });
    }
});
//# sourceMappingURL=Corpus.test.js.map
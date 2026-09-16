"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeOptions = makeOptions;
const Schema_1 = require("../Schema");
function makeOptions(ctx) {
    const utility = ctx.utility;
    const options = ctx.options;
    const struct = utility.struct;
    const items = struct.items;
    const setprop = struct.setprop;
    const merge = struct.merge;
    const validate = struct.validate;
    const escre = struct.escre;
    let opts = { ...(options || {}) };
    // EXPLICIT AUTH SUPPRESSION, captured BEFORE merge and validate.
    //
    // `auth: null` is the documented way to disable auth outright, and
    // prepareAuth honours it. But struct 0.3.2's getprop treats a stored
    // null as "no value", so validate fills in the optspec's `auth`
    // default and the suppression silently became "use default auth" —
    // transmitting a credential the caller explicitly asked not to send.
    // (0.0.10 rejected `auth: null` outright, so nothing depended on the
    // old behaviour, and nothing catches the new one.)
    //
    // Suppliedness cannot be recovered after validate, hence here.
    const authSuppressed = null === (options || {}).auth;
    // Feature add-order. `options.feature` may be given as an ordered ARRAY of
    // { name, active, ...opts } entries (the array position IS the order in
    // which features are added), or as a { name: {opts} } map. Normalize an
    // array to a map (so merge/validate/init are unchanged) and remember the
    // explicit order; a map defaults to test-first so the `test` mock transport
    // is installed as the base of the transport wrapper chain.
    let featureorder = [];
    if (Array.isArray(opts.feature)) {
        const fmap = {};
        for (const entry of opts.feature) {
            if (null != entry && null != entry.name) {
                const { name, ...fopts } = entry;
                fmap[name] = fopts;
                featureorder.push(name);
            }
        }
        opts = { ...opts, feature: fmap };
    }
    const customUtils = opts.utility || {};
    for (let [key, val] of items(customUtils)) {
        setprop(utility, key, val);
    }
    let config = ctx.config || {};
    let cfgopts = config.options || {};
    // THE OPTION SPEC IS GENERATED, NOT WRITTEN HERE.
    //
    // `Spec.OPTSPEC` is built from the model: `main.kit.optspec` for the
    // standard options, plus one entry per feature this target carries, taken
    // from that feature's own `config.options` / `config.optspec`. Editing this
    // file to add an option would put it back where it was — one of twenty
    // hand-maintained copies of a schema nothing cross-checked — so add it to
    // the model instead and every ported target validates it.
    //
    // NOT MUTATED. It is a module-level constant shared by every client this
    // process constructs; the platform default below is applied to the RESULT,
    // never to the spec.
    const optspec = Schema_1.OPTSPEC;
    // Clone the config side before merging: `config` is a module-level
    // singleton in ts/js, and merge would otherwise use its nested maps as
    // merge TARGETS — one instance's options (server, headers, ...) would
    // contaminate every instance constructed after it.
    opts = merge([{}, struct.clone(cfgopts), opts]);
    opts = validate(opts, optspec);
    // The platform fetch, supplied AFTER validate rather than as a spec
    // default. `system.fetch` is declared `$ANY`, which passes a caller's own
    // fetch through untouched but inserts nothing when the key is absent — and
    // the spec is shared, so writing the default into it (as this did while the
    // spec was a per-call literal) would hand one client's fetch to the next.
    opts.system = opts.system || {};
    if (null == opts.system.fetch) {
        opts.system.fetch = global.fetch;
    }
    // Restore the suppression the optspec default would otherwise erase.
    if (authSuppressed) {
        opts.auth = null;
    }
    // Resolve a templated base URL (e.g. https://{tenant_id}.hanko.io).
    // Every placeholder must resolve to a non-empty value: from
    // options.server (user), else the Config default. A placeholder that
    // resolves to '' is a construction ERROR in live mode — the URL cannot
    // work — but in test mode substitutes the deterministic value
    // `test-<name>` so offline tests need no configuration.
    if ('string' === typeof opts.base && opts.base.includes('{')) {
        const testmode = true === opts.test.active ||
            true === (opts.feature && opts.feature.test && opts.feature.test.active);
        const server = opts.server || {};
        opts.base = opts.base.replace(/\{([A-Za-z0-9_]+)\}/g, (_m, name) => {
            let val = server[name];
            val = 'string' === typeof val ? val : '';
            if ('' === val) {
                if (testmode) {
                    return 'test-' + name;
                }
                throw new Error(`${config?.main?.name || 'SDK'}: the server variable '${name}' is required: ` +
                    `the API base URL is '${opts.base}' — pass { server: { ${name}: '...' } } ` +
                    `in the SDK options`);
            }
            return val;
        });
    }
    // Resolve the feature add-order: an explicit array order (above) wins;
    // otherwise order the map test-first, then the remaining names sorted, so
    // the outcome is deterministic and `test` is always the base transport.
    if (0 === featureorder.length) {
        let names = Object.keys(opts.feature || {}).sort();
        names = names.indexOf('test') < 0
            ? names
            : ['test'].concat(names.filter((n) => 'test' !== n));
        // Station special case, mirroring test's: its transport wrap must
        // sit immediately outside the base transport (inside retry/cache/
        // netsim), so map-form activation hoists it to just after test -
        // or first, when no test entry exists. Without this the sorted
        // default would init station last and wrap OUTSIDE the recording
        // features, turning its wire-truth events into fiction.
        const si = names.indexOf('station');
        if (0 <= si) {
            names.splice(si, 1);
            names.splice(names.indexOf('test') + 1, 0, 'station');
        }
        featureorder = names;
    }
    opts.__derived__ = {
        clean: {
            keyre: undefined
        },
        featureorder,
    };
    const keyre = opts.clean.keys
        .split(/\s*,\s*/)
        .filter((s) => null != s && '' !== s)
        .map((key) => escre(key)).join('|');
    if ('' != keyre) {
        opts.__derived__.clean.keyre = keyre;
    }
    return opts;
}
//# sourceMappingURL=MakeOptionsUtility.js.map
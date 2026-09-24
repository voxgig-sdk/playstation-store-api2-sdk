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
    const authSuppressed = null === (options || {}).auth;
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
    const optspec = Schema_1.OPTSPEC;
    // Clone the config side before merging: `config` is a module-level
    // singleton in ts/js, and merge would otherwise use its nested maps as
    // merge TARGETS — one instance's options (server, headers, ...) would
    // contaminate every instance constructed after it.
    opts = merge([{}, struct.clone(cfgopts), opts]);
    opts = validate(opts, optspec);
    opts.system = opts.system || {};
    if (null == opts.system.fetch) {
        opts.system.fetch = global.fetch;
    }
    // Restore the suppression the optspec default would otherwise erase.
    if (authSuppressed) {
        opts.auth = null;
    }
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
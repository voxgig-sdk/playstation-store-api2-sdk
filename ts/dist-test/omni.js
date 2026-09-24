"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nullModifier = exports.OmniError = exports.UNDEFMARK = exports.NULLMARK = exports.EXISTSMARK = void 0;
exports.makeRunner = makeRunner;
const node_path_1 = require("node:path");
const index_1 = require("./vendor/omni/index");
Object.defineProperty(exports, "EXISTSMARK", { enumerable: true, get: function () { return index_1.EXISTSMARK; } });
Object.defineProperty(exports, "NULLMARK", { enumerable: true, get: function () { return index_1.NULLMARK; } });
Object.defineProperty(exports, "UNDEFMARK", { enumerable: true, get: function () { return index_1.UNDEFMARK; } });
Object.defineProperty(exports, "OmniError", { enumerable: true, get: function () { return index_1.OmniError; } });
function sdkhooks(sdk) {
    return {
        subject: (name) => {
            const utility = sdk.utility();
            return utility[name] || (utility.struct && utility.struct[name]);
        },
        // A DEF.client entry becomes another SDK instance — rewrapped with the
        // same delegating shape, not a plain hook object.
        client: async (options) => sdkprovider(await sdk.tester(options)),
        contextify: (val) => {
            const utility = sdk.utility();
            const hook = 'function' === typeof utility.contextify ? utility.contextify
                : 'function' === typeof utility.makeContext ? utility.makeContext
                    : null;
            const ctx = null == hook ? val : hook.call(utility, val);
            if (null != ctx && 'object' === typeof ctx) {
                ;
                ctx.utility = utility;
            }
            return ctx;
        },
        inject: (options, store) => {
            const structutils = sdk.utility().struct;
            if (structutils && 'function' === typeof structutils.inject) {
                return structutils.inject(options, store);
            }
            return options;
        },
        utility: () => sdk.utility(),
        tester: (options) => sdk.tester(options),
        sdk,
    };
}
// Wrap the SDK as an omni provider WITHOUT hiding it: hooks from sdkhooks,
// everything else through the prototype chain.
function sdkprovider(sdk) {
    const provider = Object.assign(Object.create(sdk), sdkhooks(sdk));
    return provider;
}
// struct's makeRunner(testfile, client) signature, backed by vendored omni.
// Also accepts an already-parsed spec object (omni's own capability), which
// keeps smoke tests free of fixture files.
async function makeRunner(testfile, client) {
    const specref = 'string' !== typeof testfile ? testfile
        : (0, node_path_1.isAbsolute)(testfile) ? testfile
            : (0, node_path_1.join)(__dirname, testfile);
    const provider = sdkprovider(client);
    const runner = await (0, index_1.makeRunner)(specref, provider);
    return async function structrunner(name, store) {
        const runpack = await runner(name, store);
        return {
            spec: runpack.spec,
            runset: runpack.runset,
            runsetflags: runpack.runsetflags,
            subject: runpack.subject,
            client: provider,
        };
    };
}
const nullModifier = index_1.nullmodifier;
exports.nullModifier = nullModifier;
//# sourceMappingURL=omni.js.map
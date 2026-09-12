"use strict";
// The corpus test runner: vendored @voxgig/omni driven through its NATIVE
// API (`makeRunner(specref, provider)`), presented to the corpus tests in
// the struct-runner shape they already use (`R.spec`, `R.runset`,
// `R.runsetflags`, `R.client`). No compat shim is vendored: the adapter
// below IS the whole bridge, per language, per the vendor-tag rollout
// (docs/design/vendor-tag-rollout.md, Decision 4).
//
// Two local decisions, both required:
//
// 1. SPEC PATH. omni's own spec resolution expects the caller to hand it a
//    usable path — its docs say a port must resolve the path itself. This
//    module compiles to dist-test/omni.js, the same depth as the old
//    dist-test/runner.js, so the existing TEST_JSON_FILE constant keeps
//    working verbatim: a relative path is absolutized against __dirname.
//
// 2. PROVIDER DELEGATION. Corpus-driven contexts get `ctx.client` set to
//    the runner's provider (omni overwrites it on any ctx/args map entry).
//    A five-hook provider object HIDES the live SDK from the generated
//    utilities that reach through it — prepareHeaders via client.options(),
//    fetcher via client._mode, the feature helpers via client._rootctx and
//    even ASSIGNING client._features. So the provider here is built by
//    PROTOTYPE DELEGATION over the live SDK instance: every SDK member
//    resolves, while the omni hooks sit on top. (Upstream omni#56 tracks
//    giving the stock provider the same shape.)
Object.defineProperty(exports, "__esModule", { value: true });
exports.nullModifier = exports.OmniError = exports.UNDEFMARK = exports.NULLMARK = exports.EXISTSMARK = void 0;
exports.makeRunner = makeRunner;
const node_path_1 = require("node:path");
const index_1 = require("./vendor/omni/index");
Object.defineProperty(exports, "EXISTSMARK", { enumerable: true, get: function () { return index_1.EXISTSMARK; } });
Object.defineProperty(exports, "NULLMARK", { enumerable: true, get: function () { return index_1.NULLMARK; } });
Object.defineProperty(exports, "UNDEFMARK", { enumerable: true, get: function () { return index_1.UNDEFMARK; } });
Object.defineProperty(exports, "OmniError", { enumerable: true, get: function () { return index_1.OmniError; } });
// The omni hooks for an SDK subject — what the retired compat shim called
// `structprovider`, inlined here because this resolver is the one consumer.
function sdkhooks(sdk) {
    return {
        // A subject is resolved from the utility, or from utility.struct.
        subject: (name) => {
            const utility = sdk.utility();
            return utility[name] || (utility.struct && utility.struct[name]);
        },
        // A DEF.client entry becomes another SDK instance — rewrapped with the
        // same delegating shape, not a plain hook object.
        client: async (options) => sdkprovider(await sdk.tester(options)),
        // The SDK supplies its own context wrapper.
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
        // Client options may reference the runner store.
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
// struct's flag-modifier name, served from native omni.
const nullModifier = index_1.nullmodifier;
exports.nullModifier = nullModifier;
//# sourceMappingURL=omni.js.map
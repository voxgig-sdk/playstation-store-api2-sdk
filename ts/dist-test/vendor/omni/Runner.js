"use strict";
// VENDORED: @voxgig/omni 0.1.4 (typescript/src/Runner.ts)
// Source: https://github.com/voxgig/omni @ b9e6085d185e174be84f9e6123be807ccd9fcb4e  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// Omni: the shared multi-language test runner.
//
// A test spec is plain JSON. The same spec file drives the same tests in
// every language that ships an omni port, so behaviour is defined once and
// verified everywhere.
//
// This file is CANONICAL. Every other port is a translation of it.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNDEFMARK = exports.NULLMARK = exports.EXISTSMARK = exports.OmniError = exports.CAPABILITIES = exports.SPECVERSION = void 0;
exports.errify = errify;
exports.fixjson = fixjson;
exports.loadspec = loadspec;
exports.makeRunner = makeRunner;
exports.match = match;
exports.matchval = matchval;
exports.nullmodifier = nullmodifier;
exports.resolvespec = resolvespec;
const node_fs_1 = require("node:fs");
const Util_1 = require("./Util");
Object.defineProperty(exports, "EXISTSMARK", { enumerable: true, get: function () { return Util_1.EXISTSMARK; } });
Object.defineProperty(exports, "NULLMARK", { enumerable: true, get: function () { return Util_1.NULLMARK; } });
Object.defineProperty(exports, "UNDEFMARK", { enumerable: true, get: function () { return Util_1.UNDEFMARK; } });
// The newest spec format version this runner understands. A spec with no
// OMNI block is version 0: the original, lenient format, frozen forever.
// Version 1 turns on strict entry validation (see checkentry).
exports.SPECVERSION = 1;
// Capability strings this runner supports beyond the version baseline. A
// spec's OMNI.requires list is checked against this: an unknown capability
// refuses the spec loudly at load time, instead of a lagging port silently
// mis-running it. (Empty today; future format features mint a string here.)
exports.CAPABILITIES = [];
// The complete set of fields an entry may carry. Under version 1 anything
// else is an error: an unrecognised key is almost always a typo'd
// assertion, and a typo'd assertion is a test that silently stopped
// testing.
const ENTRYFIELDS = ['in', 'args', 'ctx', 'out', 'err', 'match', 'client', 'id', 'doc'];
// A test failure (or a malformed spec). Distinct from errors thrown by the
// subject under test, which are candidates for an `err` expectation.
class OmniError extends Error {
    entry;
    constructor(message, entry) {
        super(message);
        this.name = 'OmniError';
        this.entry = entry;
    }
}
exports.OmniError = OmniError;
// Load a spec: either a path to a JSON file, or an already-parsed object.
function loadspec(specref) {
    if ('string' === typeof specref) {
        return JSON.parse((0, node_fs_1.readFileSync)(specref, 'utf8'));
    }
    return specref;
}
// Read the spec's format version from its optional top-level OMNI block,
// and refuse a spec this runner cannot faithfully run: a version newer
// than SPECVERSION, or a required capability not in CAPABILITIES.
function resolveversion(alltests) {
    const meta = (0, Util_1.ismap)(alltests) ? alltests.OMNI : undefined;
    if (undefined === meta) {
        return 0;
    }
    if (!(0, Util_1.ismap)(meta) || 'number' !== typeof meta.version || 0 !== meta.version % 1) {
        throw new OmniError('omni: malformed OMNI version block');
    }
    if (meta.version < 0 || exports.SPECVERSION < meta.version) {
        throw new OmniError('omni: unsupported spec version: ' + meta.version);
    }
    const requires = meta.requires;
    if (undefined !== requires) {
        if (!(0, Util_1.islist)(requires)) {
            throw new OmniError('omni: malformed OMNI requires list');
        }
        for (const cap of requires) {
            if ('string' !== typeof cap || !exports.CAPABILITIES.includes(cap)) {
                throw new OmniError('omni: spec requires unsupported capability: ' + (0, Util_1.stringify)(cap));
            }
        }
    }
    return meta.version;
}
// Strict entry validation, applied when the spec declares version 1 or
// later. The lenient format converts each of these mistakes into a silent
// pass or a dead field; here they fail with the entry named.
function checkentry(flags, index, entry) {
    if (!(0, Util_1.ismap)(entry)) {
        throw fail(flags, index, entry, 'entry is not a map');
    }
    for (const key of Object.keys(entry)) {
        if (!ENTRYFIELDS.includes(key)) {
            throw fail(flags, index, entry, 'unknown entry field: ' + key);
        }
    }
    let argsources = 0;
    for (const key of ['in', 'args', 'ctx']) {
        if (undefined !== entry[key]) {
            argsources++;
        }
    }
    if (1 < argsources) {
        throw fail(flags, index, entry, 'entry has more than one of in, args, ctx');
    }
    if (null != entry.err && undefined !== entry.out) {
        throw fail(flags, index, entry, 'entry has both err and out');
    }
    if (undefined !== entry.id && 'string' !== typeof entry.id) {
        throw fail(flags, index, entry, 'entry id is not a string');
    }
}
// Validate a version-1 group up front, against the AUTHORED entries -
// null-normalisation would otherwise rewrite an authored null (e.g.
// id: null) into a sentinel string and hide it from validation. A
// malformed spec is a spec error, not a test result, so it fails before
// any subject runs.
function checkset(flags, testspec, normalset) {
    const origset = (0, Util_1.ismap)(testspec) && (0, Util_1.islist)(testspec.set) ? testspec.set : normalset;
    if (0 === origset.length && true !== ((0, Util_1.ismap)(testspec) ? testspec.empty : undefined)) {
        throw new OmniError('omni: empty test set: ' + flags.name);
    }
    for (let index = 0; index < origset.length; index++) {
        checkentry(flags, index, origset[index]);
    }
}
// Find the named section of a spec: `primary.<name>`, then `<name>`, then
// the whole spec.
function resolvespec(name, alltests) {
    if (null == name) {
        return alltests;
    }
    const primary = alltests.primary;
    if ((0, Util_1.ismap)(primary) && null != primary[name]) {
        return primary[name];
    }
    if ((0, Util_1.ismap)(alltests) && null != alltests[name]) {
        return alltests[name];
    }
    return alltests;
}
// Build the named clients declared by the spec's DEF.client block.
async function resolveclients(provider, spec, store) {
    const clients = {};
    const defclient = (0, Util_1.ismap)(spec) && (0, Util_1.ismap)(spec.DEF) ? spec.DEF.client : undefined;
    if (!(0, Util_1.ismap)(defclient)) {
        return clients;
    }
    // A spec may define clients that a given test run never references.
    if (null == provider.client) {
        return clients;
    }
    for (const clientname of Object.keys(defclient)) {
        const cdef = defclient[clientname];
        const copts = (0, Util_1.clone)(((0, Util_1.ismap)(cdef) && (0, Util_1.ismap)(cdef.test) ? cdef.test.options : undefined) || {});
        if ((0, Util_1.ismap)(store) && null != provider.inject) {
            provider.inject(copts, store);
        }
        clients[clientname] = await provider.client(copts);
    }
    return clients;
}
function resolvesubject(name, provider) {
    if (null == name || null == provider.subject) {
        return undefined;
    }
    return provider.subject(name) || undefined;
}
function resolveflags(flags) {
    const out = null == flags ? {} : { ...flags };
    out.null = null == out.null ? true : !!out.null;
    return out;
}
// An entry with no `out` expects a null (or absent) result.
function resolveentry(entry, flags) {
    if (null == entry.out && flags.null) {
        entry.out = Util_1.NULLMARK;
    }
    return entry;
}
function resolvetestpack(name, entry, subject, provider, clients) {
    const testpack = { client: provider, subject };
    if (null != entry.client) {
        const client = clients[entry.client];
        if (null == client) {
            throw new OmniError('omni: unknown client: ' + entry.client, entry);
        }
        testpack.client = client;
        testpack.subject = resolvesubject(name, client) || subject;
    }
    return testpack;
}
// Build the argument list for one entry: `ctx` (single context argument),
// `args` (explicit list), or `in` (single value).
function resolveargs(entry, testpack, provider) {
    let args;
    if (undefined !== entry.ctx) {
        args = [entry.ctx];
    }
    else if (undefined !== entry.args) {
        args = entry.args;
    }
    else {
        args = [(0, Util_1.clone)(entry.in)];
    }
    if (undefined !== entry.ctx || undefined !== entry.args) {
        let first = args[0];
        if ((0, Util_1.ismap)(first)) {
            first = (0, Util_1.clone)(first);
            if (null != provider.contextify) {
                first = provider.contextify(first);
            }
            args[0] = first;
            entry.ctx = first;
            if ((0, Util_1.ismap)(first)) {
                first.client = testpack.client;
            }
        }
    }
    return args;
}
// Normalise a value for comparison: JSON nulls (and absent values) become
// the NULLMARK sentinel, errors become {name,message} maps. Always returns
// a fresh copy, so a spec can be run repeatedly.
function fixjson(val, flags) {
    const donull = null == flags || null == flags.null ? true : !!flags.null;
    return fixjsonval(val, donull);
}
function fixjsonval(val, donull) {
    if (null == val) {
        return donull ? Util_1.NULLMARK : val;
    }
    if (val instanceof Error) {
        return errify(val);
    }
    if ((0, Util_1.islist)(val)) {
        return val.map((entry) => fixjsonval(entry, donull));
    }
    if ((0, Util_1.ismap)(val)) {
        const out = {};
        for (const key of Object.keys(val)) {
            out[key] = fixjsonval(val[key], donull);
        }
        return out;
    }
    return val;
}
// The JSON form of an error: always at least {name,message}.
//
// A thrown value need not be an Error. Ports commonly rethrow an
// error-SHAPED map ({name, message, ...}) - voxgig/sdkgen's generated
// makeError rethrows the fixture's own error object verbatim - and
// collapsing that to String(err) yields '[object Object]', which fails both
// the `err` check and every `match.err.*` leaf. The struct repository's
// original runner read `.message` regardless of the thrown value's class.
// THE SPREAD IS THE CONTRACT, not an accident of JavaScript. An error's
// OWN enumerable properties survive into the base, so a library whose
// errors carry a `code` (or a `status`, or a `path`) can assert on it
// with `match: {err: {code: 'x'}}` rather than pattern-matching prose.
//
// Only JavaScript gets that for free. A port whose subject reports
// failure as a message string - rust, cpp, zig, ocaml, haskell - has
// nothing to spread, and a port that builds `{name, message}` by hand
// drops the fields even when it has them. `Provider.errify` is how those
// ports reach the same place: it overrides this function entirely, so a
// library supplies its own structured base and omni needs to know
// nothing about the shape of it.
function errify(err) {
    if (err instanceof Error) {
        return { ...err, name: err.name, message: err.message };
    }
    if (null != err && 'object' === typeof err) {
        return { name: 'Error', ...err };
    }
    return { name: 'Error', message: String(err) };
}
// The error base a `match.err` sees: the provider's own, when it has one.
function errbase(err, provider) {
    return null != provider && null != provider.errify
        ? provider.errify(err)
        : errify(err);
}
function errmessage(err) {
    return err instanceof Error ? err.message
        : null != err && 'string' === typeof err.message ? err.message
            : String(err);
}
// The label of one entry, for failure messages.
function entryref(flags, index, entry) {
    const label = flags.name || 'set';
    const id = null != entry && null != entry.id ? ' (' + entry.id + ')' : '';
    return label + '[' + index + ']' + id;
}
function fail(flags, index, entry, reason, expected, actual) {
    let msg = 'omni: ' + entryref(flags, index, entry) + ': ' + reason;
    if (undefined !== expected) {
        msg += '\n  expected: ' + expected;
    }
    if (undefined !== actual) {
        msg += '\n  actual:   ' + actual;
    }
    msg += '\n  entry:    ' + (0, Util_1.stringify)(entrysummary(entry));
    return new OmniError(msg, entry);
}
// The spec-defined part of an entry (drop runner bookkeeping).
function entrysummary(entry) {
    if (!(0, Util_1.ismap)(entry)) {
        return entry;
    }
    const out = {};
    for (const key of Object.keys(entry)) {
        if ('res' !== key && 'thrown' !== key && 'ctx' !== key) {
            out[key] = entry[key];
        }
    }
    return out;
}
function checkresult(flags, index, entry, args, res) {
    let matched = false;
    if (null != entry.err) {
        throw fail(flags, index, entry, 'expected error did not occur', (0, Util_1.stringify)(entry.err), (0, Util_1.stringify)(res));
    }
    if (null != entry.match) {
        match(flags, index, entry, entry.match, {
            in: entry.in,
            args,
            out: entry.res,
            ctx: entry.ctx,
        });
        matched = true;
    }
    const out = entry.out;
    if (out === res) {
        return;
    }
    // NOTE: a match with no explicit out is a complete check on its own.
    if (matched && (Util_1.NULLMARK === out || null == out)) {
        return;
    }
    if (!(0, Util_1.deepequal)(res, out)) {
        throw fail(flags, index, entry, 'result mismatch', (0, Util_1.stringify)(out), (0, Util_1.stringify)(res));
    }
}
function handleerror(flags, index, entry, err, provider) {
    entry.thrown = err;
    const entryerr = entry.err;
    if (null != entryerr) {
        if (true === entryerr || matchval(entryerr, errmessage(err))) {
            if (null != entry.match) {
                match(flags, index, entry, entry.match, {
                    in: entry.in,
                    out: entry.res,
                    ctx: entry.ctx,
                    err: errbase(err, provider),
                });
            }
            return;
        }
        throw fail(flags, index, entry, 'error mismatch', (0, Util_1.stringify)(entryerr), errmessage(err));
    }
    throw fail(flags, index, entry, 'unexpected error', undefined, errmessage(err));
}
// Check that every leaf of `check` is present, and matches, in `base`.
function match(flags, index, entry, check, base) {
    // Read the base DIRECTLY. The clone bought nothing - the walk below only
    // reads, via getpath - and it blows the stack on a cyclic base. A port
    // that drives entries with live objects rather than pure JSON produces
    // those routinely: voxgig/sdkgen's corpus matches against a live client
    // context whose root context reaches the client again.
    const cbase = base;
    const at = (path) => (0 === path.length ? '<root>' : (0, Util_1.pathify)(path));
    (0, Util_1.walk)((0, Util_1.clone)(check), (_key, val, _parent, path) => {
        // An empty container in the check is a structural placeholder: it has
        // no leaves to check, so it matches whatever is at that path. This is
        // deliberate - voxgig/struct's corpus relies on it (struct-compat), and
        // an empty sub-pattern matching anything is the usual partial-match
        // convention. The leaf checks below are where the strictness lives.
        if (!(0, Util_1.isnode)(val)) {
            const baseval = (0, Util_1.getpath)(cbase, path);
            // The sentinels are tested BEFORE the identity check below. Otherwise
            // a subject returning the literal string "__UNDEF__" satisfies an
            // assertion that the key is absent - two mutually exclusive states
            // passing one check. A sentinel that accepts its own literal is not a
            // sentinel. (NULLMARK still accepts NULLMARK: under the default null
            // flag a real null has already been normalised to it, so the two are
            // genuinely indistinguishable here - that one needs a raw-value
            // escape, not an ordering change.)
            // Explicitly absent: satisfied only by a genuinely missing key, never
            // by a present null (the distinction the sentinels exist to keep).
            if (Util_1.UNDEFMARK === val) {
                if (undefined === baseval) {
                    return val;
                }
                throw fail(flags, index, entry, 'expected absent at ' + at(path), 'absent', (0, Util_1.stringify)(baseval));
            }
            // Explicitly null: satisfied only by a present null.
            if (Util_1.NULLMARK === val) {
                if (null === baseval || Util_1.NULLMARK === baseval) {
                    return val;
                }
                throw fail(flags, index, entry, 'expected null at ' + at(path), 'null', (0, Util_1.stringify)(baseval));
            }
            // Explicitly present: any present value, including null.
            if (Util_1.EXISTSMARK === val) {
                if (undefined !== baseval) {
                    return val;
                }
                throw fail(flags, index, entry, 'expected present at ' + at(path), 'present', 'absent');
            }
            // Identical values match. This sits below the sentinel branches on
            // purpose - see the note above.
            if (baseval === val) {
                return val;
            }
            // A concrete expectation never matches a missing key - a match leaf
            // against an absent value must fail, not substring-match "undefined".
            if (undefined === baseval) {
                throw fail(flags, index, entry, 'match failed at ' + at(path), (0, Util_1.stringify)(val), 'absent');
            }
            if (!matchval(val, baseval)) {
                throw fail(flags, index, entry, 'match failed at ' + at(path), (0, Util_1.stringify)(val), (0, Util_1.stringify)(baseval));
            }
        }
        return val;
    });
}
// Match one leaf. Strings are matched as /regex/ or as a case-insensitive
// substring, which is what makes error-message expectations portable.
function matchval(check, base) {
    if (check === base) {
        return true;
    }
    let want = check;
    if (Util_1.UNDEFMARK === want || Util_1.NULLMARK === want) {
        want = null;
    }
    if (null == want) {
        return null == base || Util_1.NULLMARK === base;
    }
    if ('string' === typeof want) {
        // An empty want is not a wildcard: the empty string is a substring of
        // everything, so `match:{out:""}` (or `err:""`) would accept any value.
        if ('' === want) {
            return '' === base;
        }
        const basestr = (0, Util_1.stringify)(base);
        const rem = want.match(/^\/(.+)\/$/);
        if (rem) {
            return new RegExp(rem[1]).test(basestr);
        }
        return basestr.toLowerCase().includes(want.toLowerCase());
    }
    if ('function' === typeof want) {
        return true;
    }
    return (0, Util_1.deepequal)(want, base);
}
// Convert NULLMARK sentinels back into real nulls. Use as a walk callback
// when a spec value must reach the subject as an actual null.
function nullmodifier(val, key, parent) {
    if (Util_1.NULLMARK === val) {
        parent[key] = null;
    }
    else if ('string' === typeof val) {
        parent[key] = val.split(Util_1.NULLMARK).join('null');
    }
}
// Make a runner for a spec file (or spec object) and a provider.
async function makeRunner(specref, provider) {
    const alltests = loadspec(specref);
    const specversion = resolveversion(alltests);
    const useprovider = provider || {};
    return async function runner(name, store) {
        const spec = resolvespec(name, alltests);
        const clients = await resolveclients(useprovider, spec, store || {});
        const defsubject = resolvesubject(name, useprovider);
        const runsetflags = async (testspec, flags, testsubject) => {
            const useflags = resolveflags(flags);
            useflags.name = useflags.name || name || 'set';
            const subject = testsubject || defsubject;
            if (null == subject) {
                throw new OmniError('omni: no test subject for: ' + useflags.name);
            }
            const testspecmap = fixjson(testspec, useflags);
            if (!(0, Util_1.ismap)(testspecmap) || !(0, Util_1.islist)(testspecmap.set)) {
                throw new OmniError('omni: test spec has no set: ' + useflags.name);
            }
            const testset = testspecmap.set;
            if (1 <= specversion) {
                checkset(useflags, testspec, testset);
            }
            for (let index = 0; index < testset.length; index++) {
                let entry = testset[index];
                try {
                    entry = resolveentry(entry, useflags);
                    const testpack = resolvetestpack(name, entry, subject, useprovider, clients);
                    const args = resolveargs(entry, testpack, useprovider);
                    let res = await testpack.subject(...args);
                    res = fixjson(res, useflags);
                    entry.res = res;
                    checkresult(useflags, index, entry, args, res);
                }
                catch (err) {
                    if (err instanceof OmniError) {
                        throw err;
                    }
                    handleerror(useflags, index, entry, err, useprovider);
                }
            }
        };
        const runset = async (testspec, testsubject) => runsetflags(testspec, {}, testsubject);
        return {
            spec,
            runset,
            runsetflags,
            subject: defsubject,
            client: useprovider,
        };
    };
}
//# sourceMappingURL=Runner.js.map
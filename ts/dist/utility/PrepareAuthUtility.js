"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareAuth = prepareAuth;
const CRED_name = 'authorization';
const OPTION_apikey = 'apikey';
const OPTION_secret = 'secret';
const NOTFOUND = '__NOTFOUND__';
function prepareAuth(ctx) {
    const utility = ctx.utility;
    const struct = utility.struct;
    const getprop = struct.getprop;
    const setprop = struct.setprop;
    const delprop = struct.delprop;
    const client = ctx.client;
    const spec = ctx.spec;
    if (null == spec) {
        return ctx.error('auth_no_spec', 'Expected context spec property to be defined.');
    }
    const headers = spec.headers;
    const options = client.options();
    // Public APIs that need no auth omit the options.auth block entirely.
    if (null == options.auth) {
        delprop(headers, CRED_name);
        return spec;
    }
    const prefix = options.auth.prefix;
    const apikey = getprop(options, OPTION_apikey, NOTFOUND);
    if (NOTFOUND === apikey || null == apikey || '' === apikey) {
        delprop(headers, CRED_name);
    }
    else {
        // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
        // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
        setprop(headers, CRED_name, prefix ? prefix + ' ' + apikey : apikey);
    }
    return spec;
}
//# sourceMappingURL=PrepareAuthUtility.js.map
"use strict";
// VENDORED: @voxgig/omni 0.1.4 (typescript/src/index.ts)
// Source: https://github.com/voxgig/omni @ b909ff51fc644e4955c850e30cc65e74be076df2  [tag: sdk-20260925-1316-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// @voxgig/omni - shared multi-language test runner.
Object.defineProperty(exports, "__esModule", { value: true });
exports.walk = exports.stringify = exports.pathify = exports.jsonstr = exports.isnode = exports.ismap = exports.islist = exports.getpath = exports.deepequal = exports.clone = exports.resolvespec = exports.nullmodifier = exports.matchval = exports.match = exports.makeRunner = exports.loadspec = exports.fixjson = exports.errify = exports.UNDEFMARK = exports.SPECVERSION = exports.OmniError = exports.NULLMARK = exports.EXISTSMARK = exports.CAPABILITIES = void 0;
var Runner_1 = require("./Runner");
Object.defineProperty(exports, "CAPABILITIES", { enumerable: true, get: function () { return Runner_1.CAPABILITIES; } });
Object.defineProperty(exports, "EXISTSMARK", { enumerable: true, get: function () { return Runner_1.EXISTSMARK; } });
Object.defineProperty(exports, "NULLMARK", { enumerable: true, get: function () { return Runner_1.NULLMARK; } });
Object.defineProperty(exports, "OmniError", { enumerable: true, get: function () { return Runner_1.OmniError; } });
Object.defineProperty(exports, "SPECVERSION", { enumerable: true, get: function () { return Runner_1.SPECVERSION; } });
Object.defineProperty(exports, "UNDEFMARK", { enumerable: true, get: function () { return Runner_1.UNDEFMARK; } });
Object.defineProperty(exports, "errify", { enumerable: true, get: function () { return Runner_1.errify; } });
Object.defineProperty(exports, "fixjson", { enumerable: true, get: function () { return Runner_1.fixjson; } });
Object.defineProperty(exports, "loadspec", { enumerable: true, get: function () { return Runner_1.loadspec; } });
Object.defineProperty(exports, "makeRunner", { enumerable: true, get: function () { return Runner_1.makeRunner; } });
Object.defineProperty(exports, "match", { enumerable: true, get: function () { return Runner_1.match; } });
Object.defineProperty(exports, "matchval", { enumerable: true, get: function () { return Runner_1.matchval; } });
Object.defineProperty(exports, "nullmodifier", { enumerable: true, get: function () { return Runner_1.nullmodifier; } });
Object.defineProperty(exports, "resolvespec", { enumerable: true, get: function () { return Runner_1.resolvespec; } });
var Util_1 = require("./Util");
Object.defineProperty(exports, "clone", { enumerable: true, get: function () { return Util_1.clone; } });
Object.defineProperty(exports, "deepequal", { enumerable: true, get: function () { return Util_1.deepequal; } });
Object.defineProperty(exports, "getpath", { enumerable: true, get: function () { return Util_1.getpath; } });
Object.defineProperty(exports, "islist", { enumerable: true, get: function () { return Util_1.islist; } });
Object.defineProperty(exports, "ismap", { enumerable: true, get: function () { return Util_1.ismap; } });
Object.defineProperty(exports, "isnode", { enumerable: true, get: function () { return Util_1.isnode; } });
Object.defineProperty(exports, "jsonstr", { enumerable: true, get: function () { return Util_1.jsonstr; } });
Object.defineProperty(exports, "pathify", { enumerable: true, get: function () { return Util_1.pathify; } });
Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return Util_1.stringify; } });
Object.defineProperty(exports, "walk", { enumerable: true, get: function () { return Util_1.walk; } });
//# sourceMappingURL=index.js.map
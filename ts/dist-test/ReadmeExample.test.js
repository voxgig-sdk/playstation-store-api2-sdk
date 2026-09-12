"use strict";
// Verifies the README's lead-language quickstart still runs.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const Fs = __importStar(require("node:fs"));
const Path = __importStar(require("node:path"));
const __1 = require("..");
function findFirstTsBlock(md, sectionHeading) {
    const escapedHeading = sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('##\\s+' + escapedHeading + '[\\s\\S]*?```ts\\n([\\s\\S]*?)```');
    const m = md.match(re);
    return m ? m[1] : null;
}
function transformForTestMode(code, name) {
    // Strip import lines — symbols come from the test's outer scope.
    let out = code.replace(/^\s*import\s+[^;\n]+;?\s*$/gm, '');
    // Swap real client construction for test mode (no network, no auth).
    out = out.replace(new RegExp('new\\s+' + name + 'SDK\\([^)]*\\)', 'g'), name + 'SDK.test()');
    return out;
}
(0, node_test_1.describe)('README example', () => {
    (0, node_test_1.it)('lead-language quickstart runs in test mode', async () => {
        const readmePath = Path.join(__dirname, '..', '..', 'README.md');
        const md = Fs.readFileSync(readmePath, 'utf8');
        const block = findFirstTsBlock(md, 'Quickstart');
        (0, node_assert_1.default)(block, 'No TypeScript code block found under "## Quickstart" in README.md');
        const code = transformForTestMode(block, 'PlaystationStoreApi2');
        // Run the (transformed) example. Async, so wrap in AsyncFunction.
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        const silentConsole = { log: () => { }, error: () => { }, warn: () => { } };
        const runner = new AsyncFunction('PlaystationStoreApi2SDK', 'console', code);
        // The example should at least parse and have a valid call shape
        // (every method exists on the SDK and accepts the args shown). A
        // "Not found" / 404 from test mode means the SDK accepted the call
        // but there's no fixture for that match — that's a test-data gap,
        // not a README bug, so it's OK. Everything else (TypeError,
        // ReferenceError, SyntaxError) means the README example is out of
        // sync with the real SDK API and the test should fail.
        try {
            await runner(__1.PlaystationStoreApi2SDK, silentConsole);
        }
        catch (err) {
            const msg = String(err?.message ?? err);
            if (/\b(404|Not found)\b/i.test(msg))
                return;
            throw err;
        }
    });
});
//# sourceMappingURL=ReadmeExample.test.js.map
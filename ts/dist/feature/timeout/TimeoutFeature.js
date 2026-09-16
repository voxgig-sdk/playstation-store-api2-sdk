"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutFeature = void 0;
const BaseFeature_1 = require("../base/BaseFeature");
// Per-request timeout. Wraps the active transport and races each attempt
// against a deadline; if the deadline wins, the request resolves to a
// timeout error instead of hanging. An `AbortController` is signalled (via
// `fetchdef.signal`) so a live `fetch` is actually cancelled, while the
// mock transport simply loses the race.
class TimeoutFeature extends BaseFeature_1.BaseFeature {
    version = '0.0.1';
    name = 'timeout';
    active = true;
    _client;
    _options = {};
    init(ctx, options) {
        this._client = ctx.client;
        this._options = options || {};
        this.active = options.active;
        if (!this.active) {
            return;
        }
        const self = this;
        const utility = ctx.utility;
        const inner = utility.fetcher;
        utility.fetcher = async function (ctx2, url, fetchdef) {
            return self._withTimeout(ctx2, url, fetchdef, inner);
        };
    }
    async _withTimeout(ctx, url, fetchdef, inner) {
        const ms = null == this._options.ms ? 30000 : this._options.ms;
        if (0 >= ms) {
            return inner(ctx, url, fetchdef);
        }
        // Attach an abort signal so a real fetch can be cancelled on timeout.
        let controller;
        if ('function' === typeof globalThis.AbortController) {
            controller = new globalThis.AbortController();
            fetchdef = { ...fetchdef, signal: controller.signal };
        }
        let timer;
        const timeout = new Promise((resolve) => {
            const schedule = this._options.setTimer;
            const fn = () => resolve(ctx.error('timeout', 'Request exceeded timeout of ' + ms + 'ms'));
            if ('function' === typeof schedule) {
                timer = schedule(fn, ms);
            }
            else {
                timer = setTimeout(fn, ms);
            }
        });
        try {
            const res = await Promise.race([
                Promise.resolve().then(() => inner(ctx, url, fetchdef)),
                timeout,
            ]);
            if (res instanceof Error && res.code === 'timeout' && null != controller) {
                try {
                    controller.abort();
                }
                catch (_e) { }
                this._track(ctx, ms);
            }
            return res;
        }
        finally {
            const clear = this._options.clearTimer;
            if ('function' === typeof clear) {
                clear(timer);
            }
            else if (null != timer) {
                clearTimeout(timer);
            }
        }
    }
    _track(ctx, ms) {
        const client = this._client;
        if (null == client._timeout) {
            client._timeout = { count: 0, ms };
        }
        client._timeout.count++;
    }
}
exports.TimeoutFeature = TimeoutFeature;
//# sourceMappingURL=TimeoutFeature.js.map
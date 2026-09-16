"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RatelimitFeature = void 0;
const BaseFeature_1 = require("../base/BaseFeature");
// Client-side rate limiting via a token bucket. Each request consumes a
// token; when the bucket is empty the request waits until the bucket
// refills at `rate` tokens per second (with capacity `burst`). This keeps
// the client under a server's published quota rather than discovering it
// via 429s. The clock (`now`) and the wait (`sleep`) are injectable so the
// accounting can be tested deterministically without wall-clock timing.
class RatelimitFeature extends BaseFeature_1.BaseFeature {
    version = '0.0.1';
    name = 'ratelimit';
    active = true;
    _client;
    _options = {};
    _tokens = 0;
    _last = 0;
    init(ctx, options) {
        this._client = ctx.client;
        this._options = options || {};
        this.active = options.active;
        if (!this.active) {
            return;
        }
        const burst = null == this._options.burst ? (this._options.rate || 5) : this._options.burst;
        this._tokens = burst;
        this._last = this._now();
        const self = this;
        const utility = ctx.utility;
        const inner = utility.fetcher;
        utility.fetcher = async function (ctx2, url, fetchdef) {
            await self._acquire(ctx2);
            return inner(ctx2, url, fetchdef);
        };
    }
    async _acquire(ctx) {
        const rate = this._options.rate || 5;
        const burst = null == this._options.burst ? rate : this._options.burst;
        // Refill according to elapsed time.
        const now = this._now();
        const elapsed = now - this._last;
        this._last = now;
        this._tokens = Math.min(burst, this._tokens + (elapsed / 1000) * rate);
        if (this._tokens >= 1) {
            this._tokens -= 1;
            return;
        }
        // Not enough tokens: wait for one to accrue, then consume it.
        const needed = 1 - this._tokens;
        const waitMs = Math.ceil((needed / rate) * 1000);
        this._track(ctx, waitMs);
        await this._sleep(waitMs);
        this._last = this._now();
        this._tokens = 0;
    }
    _now() {
        const now = this._options.now;
        if ('function' === typeof now) {
            return now();
        }
        return Date.now();
    }
    _sleep(ms) {
        if (null == ms || 0 >= ms) {
            return Promise.resolve();
        }
        const sleep = this._options.sleep;
        if ('function' === typeof sleep) {
            return Promise.resolve(sleep(ms));
        }
        return new Promise((r) => setTimeout(r, ms));
    }
    _track(ctx, waitMs) {
        const client = this._client;
        if (null == client._ratelimit) {
            client._ratelimit = { throttled: 0, waitMs: 0 };
        }
        client._ratelimit.throttled++;
        client._ratelimit.waitMs += waitMs;
    }
}
exports.RatelimitFeature = RatelimitFeature;
//# sourceMappingURL=RatelimitFeature.js.map
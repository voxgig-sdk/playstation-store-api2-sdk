"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryFeature = void 0;
const BaseFeature_1 = require("../base/BaseFeature");
// Automatic retry of transient failures with exponential backoff and
// jitter. Wraps the active transport so a single operation call may make
// several HTTP attempts. A failure is retryable when the transport throws
// / returns an Error, or responds with a status in `statuses`
// (default: 408, 425, 429, 500, 502, 503, 504). An HTTP 429/503 with a
// `Retry-After` header overrides the computed backoff.
class RetryFeature extends BaseFeature_1.BaseFeature {
    version = '0.0.1';
    name = 'retry';
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
            return self._withRetry(ctx2, url, fetchdef, inner);
        };
    }
    async _withRetry(ctx, url, fetchdef, inner) {
        const opts = this._options;
        const max = null == opts.retries ? 2 : (opts.retries | 0);
        const minDelay = null == opts.minDelay ? 50 : opts.minDelay;
        const maxDelay = null == opts.maxDelay ? 2000 : opts.maxDelay;
        const factor = null == opts.factor ? 2 : opts.factor;
        let attempt = 0;
        let last;
        for (;;) {
            let res;
            let threw = false;
            try {
                res = await inner(ctx, url, fetchdef);
            }
            catch (err) {
                threw = true;
                res = err;
            }
            last = res;
            const retryable = this._retryable(res);
            if (!retryable || attempt >= max) {
                // Out of attempts: rethrow a thrown error to preserve pipeline
                // semantics, otherwise return the last response/error.
                if (threw && attempt >= max) {
                    throw res;
                }
                return res;
            }
            const wait = this._backoff(res, attempt, minDelay, maxDelay, factor);
            this._track(ctx, attempt + 1, res, wait);
            await this._sleep(wait);
            attempt++;
        }
    }
    _retryable(res) {
        if (null == res) {
            return true;
        }
        if (res instanceof Error) {
            return true;
        }
        const status = res.status;
        if ('number' !== typeof status) {
            return false;
        }
        const statuses = this._options.statuses || [408, 425, 429, 500, 502, 503, 504];
        return statuses.indexOf(status) >= 0;
    }
    _backoff(res, attempt, minDelay, maxDelay, factor) {
        // Honour a server-provided Retry-After (seconds) when present.
        const ra = this._retryAfter(res);
        if (null != ra) {
            return Math.min(maxDelay, ra);
        }
        const base = minDelay * Math.pow(factor, attempt);
        const jitter = false === this._options.jitter ? 0 : Math.floor(Math.random() * minDelay);
        return Math.min(maxDelay, base + jitter);
    }
    _retryAfter(res) {
        if (null == res || null == res.headers) {
            return null;
        }
        let v;
        if ('function' === typeof res.headers.get) {
            v = res.headers.get('retry-after');
        }
        else {
            v = res.headers['retry-after'];
        }
        if (null == v) {
            return null;
        }
        const n = Number(v);
        return isNaN(n) ? null : n * 1000;
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
    _track(ctx, attempt, res, wait) {
        const client = this._client;
        if (null == client._retry) {
            client._retry = { attempts: 0, retries: [] };
        }
        client._retry.attempts++;
        client._retry.retries.push({
            attempt,
            status: res && res.status,
            error: res instanceof Error ? res.message : undefined,
            wait,
        });
    }
}
exports.RetryFeature = RetryFeature;
//# sourceMappingURL=RetryFeature.js.map
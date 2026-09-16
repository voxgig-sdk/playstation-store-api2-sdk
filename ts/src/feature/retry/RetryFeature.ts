
import type { Context, FeatureOptions } from '../../types'
import type { PlaystationStoreApi2SDK } from '../../PlaystationStoreApi2SDK'

import { BaseFeature } from '../base/BaseFeature'


// Automatic retry of transient failures with exponential backoff and
// jitter. Wraps the active transport so a single operation call may make
// several HTTP attempts. A failure is retryable when the transport throws
// / returns an Error, or responds with a status in `statuses`
// (default: 408, 425, 429, 500, 502, 503, 504). An HTTP 429/503 with a
// `Retry-After` header overrides the computed backoff.
class RetryFeature extends BaseFeature {
  version = '0.0.1'
  name = 'retry'
  active = true

  _client?: PlaystationStoreApi2SDK
  _options: any = {}


  init(ctx: Context, options: FeatureOptions): void | Promise<any> {
    this._client = ctx.client
    this._options = options || {}
    this.active = (options as any).active

    if (!this.active) {
      return
    }

    const self = this
    const utility = ctx.utility
    const inner = utility.fetcher

    utility.fetcher = async function (ctx2: any, url: string, fetchdef: any) {
      return self._withRetry(ctx2, url, fetchdef, inner)
    }
  }


  async _withRetry(this: any, ctx: any, url: string, fetchdef: any, inner: any): Promise<any> {
    const opts = this._options
    const max = null == opts.retries ? 2 : (opts.retries | 0)
    const minDelay = null == opts.minDelay ? 50 : opts.minDelay
    const maxDelay = null == opts.maxDelay ? 2000 : opts.maxDelay
    const factor = null == opts.factor ? 2 : opts.factor

    let attempt = 0
    let last: any

    for (; ;) {
      let res: any
      let threw = false
      try {
        res = await inner(ctx, url, fetchdef)
      }
      catch (err: any) {
        threw = true
        res = err
      }

      last = res

      const retryable = this._retryable(res)
      if (!retryable || attempt >= max) {
        // Out of attempts: rethrow a thrown error to preserve pipeline
        // semantics, otherwise return the last response/error.
        if (threw && attempt >= max) {
          throw res
        }
        return res
      }

      const wait = this._backoff(res, attempt, minDelay, maxDelay, factor)
      this._track(ctx, attempt + 1, res, wait)
      await this._sleep(wait)
      attempt++
    }
  }


  _retryable(this: any, res: any): boolean {
    if (null == res) {
      return true
    }
    if (res instanceof Error) {
      return true
    }
    const status = res.status
    if ('number' !== typeof status) {
      return false
    }
    const statuses = this._options.statuses || [408, 425, 429, 500, 502, 503, 504]
    return statuses.indexOf(status) >= 0
  }


  _backoff(this: any, res: any, attempt: number, minDelay: number, maxDelay: number, factor: number): number {
    // Honour a server-provided Retry-After (seconds) when present.
    const ra = this._retryAfter(res)
    if (null != ra) {
      return Math.min(maxDelay, ra)
    }
    const base = minDelay * Math.pow(factor, attempt)
    const jitter = false === this._options.jitter ? 0 : Math.floor(Math.random() * minDelay)
    return Math.min(maxDelay, base + jitter)
  }


  _retryAfter(this: any, res: any): number | null {
    if (null == res || null == res.headers) {
      return null
    }
    let v: any
    if ('function' === typeof res.headers.get) {
      v = res.headers.get('retry-after')
    }
    else {
      v = res.headers['retry-after']
    }
    if (null == v) {
      return null
    }
    const n = Number(v)
    return isNaN(n) ? null : n * 1000
  }


  _sleep(this: any, ms: number): Promise<void> {
    if (null == ms || 0 >= ms) {
      return Promise.resolve()
    }
    const sleep = this._options.sleep
    if ('function' === typeof sleep) {
      return Promise.resolve(sleep(ms))
    }
    return new Promise((r) => setTimeout(r, ms))
  }


  _track(this: any, ctx: any, attempt: number, res: any, wait: number) {
    const client: any = this._client
    if (null == client._retry) {
      client._retry = { attempts: 0, retries: [] }
    }
    client._retry.attempts++
    client._retry.retries.push({
      attempt,
      status: res && res.status,
      error: res instanceof Error ? res.message : undefined,
      wait,
    })
  }
}


export {
  RetryFeature
}

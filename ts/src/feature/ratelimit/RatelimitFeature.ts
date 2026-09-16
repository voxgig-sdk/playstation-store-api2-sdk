
import type { Context, FeatureOptions } from '../../types'
import type { PlaystationStoreApi2SDK } from '../../PlaystationStoreApi2SDK'

import { BaseFeature } from '../base/BaseFeature'


// Client-side rate limiting via a token bucket. Each request consumes a
// token; when the bucket is empty the request waits until the bucket
// refills at `rate` tokens per second (with capacity `burst`). This keeps
// the client under a server's published quota rather than discovering it
// via 429s. The clock (`now`) and the wait (`sleep`) are injectable so the
// accounting can be tested deterministically without wall-clock timing.
class RatelimitFeature extends BaseFeature {
  version = '0.0.1'
  name = 'ratelimit'
  active = true

  _client?: PlaystationStoreApi2SDK
  _options: any = {}
  _tokens = 0
  _last = 0


  init(ctx: Context, options: FeatureOptions): void | Promise<any> {
    this._client = ctx.client
    this._options = options || {}
    this.active = (options as any).active

    if (!this.active) {
      return
    }

    const burst = null == this._options.burst ? (this._options.rate || 5) : this._options.burst
    this._tokens = burst
    this._last = this._now()

    const self = this
    const utility = ctx.utility
    const inner = utility.fetcher

    utility.fetcher = async function (ctx2: any, url: string, fetchdef: any) {
      await self._acquire(ctx2)
      return inner(ctx2, url, fetchdef)
    }
  }


  async _acquire(this: any, ctx: any): Promise<void> {
    const rate = this._options.rate || 5
    const burst = null == this._options.burst ? rate : this._options.burst

    // Refill according to elapsed time.
    const now = this._now()
    const elapsed = now - this._last
    this._last = now
    this._tokens = Math.min(burst, this._tokens + (elapsed / 1000) * rate)

    if (this._tokens >= 1) {
      this._tokens -= 1
      return
    }

    // Not enough tokens: wait for one to accrue, then consume it.
    const needed = 1 - this._tokens
    const waitMs = Math.ceil((needed / rate) * 1000)
    this._track(ctx, waitMs)
    await this._sleep(waitMs)
    this._last = this._now()
    this._tokens = 0
  }


  _now(this: any): number {
    const now = this._options.now
    if ('function' === typeof now) {
      return now()
    }
    return Date.now()
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


  _track(this: any, ctx: any, waitMs: number) {
    const client: any = this._client
    if (null == client._ratelimit) {
      client._ratelimit = { throttled: 0, waitMs: 0 }
    }
    client._ratelimit.throttled++
    client._ratelimit.waitMs += waitMs
  }
}


export {
  RatelimitFeature
}

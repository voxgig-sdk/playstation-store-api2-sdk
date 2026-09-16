import type { Context, FeatureOptions } from '../../types';
import type { PlaystationStoreApi2SDK } from '../../PlaystationStoreApi2SDK';
import { BaseFeature } from '../base/BaseFeature';
declare class RetryFeature extends BaseFeature {
    version: string;
    name: string;
    active: boolean;
    _client?: PlaystationStoreApi2SDK;
    _options: any;
    init(ctx: Context, options: FeatureOptions): void | Promise<any>;
    _withRetry(this: any, ctx: any, url: string, fetchdef: any, inner: any): Promise<any>;
    _retryable(this: any, res: any): boolean;
    _backoff(this: any, res: any, attempt: number, minDelay: number, maxDelay: number, factor: number): number;
    _retryAfter(this: any, res: any): number | null;
    _sleep(this: any, ms: number): Promise<void>;
    _track(this: any, ctx: any, attempt: number, res: any, wait: number): void;
}
export { RetryFeature };

import type { Context, FeatureOptions } from '../../types';
import type { PlaystationStoreApi2SDK } from '../../PlaystationStoreApi2SDK';
import { BaseFeature } from '../base/BaseFeature';
declare class TimeoutFeature extends BaseFeature {
    version: string;
    name: string;
    active: boolean;
    _client?: PlaystationStoreApi2SDK;
    _options: any;
    init(ctx: Context, options: FeatureOptions): void | Promise<any>;
    _withTimeout(this: any, ctx: any, url: string, fetchdef: any, inner: any): Promise<any>;
    _track(this: any, ctx: any, ms: number): void;
}
export { TimeoutFeature };

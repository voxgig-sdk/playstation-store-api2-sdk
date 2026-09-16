import type { Context, FeatureOptions } from '../../types';
import type { PlaystationStoreApi2SDK } from '../../PlaystationStoreApi2SDK';
import { BaseFeature } from '../base/BaseFeature';
declare class RatelimitFeature extends BaseFeature {
    version: string;
    name: string;
    active: boolean;
    _client?: PlaystationStoreApi2SDK;
    _options: any;
    _tokens: number;
    _last: number;
    init(ctx: Context, options: FeatureOptions): void | Promise<any>;
    _acquire(this: any, ctx: any): Promise<void>;
    _now(this: any): number;
    _sleep(this: any, ms: number): Promise<void>;
    _track(this: any, ctx: any, waitMs: number): void;
}
export { RatelimitFeature };

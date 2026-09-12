import type { Feature, Context, FeatureOptions } from '../../types';
declare class BaseFeature implements Feature {
    version: string;
    name: string;
    active: boolean;
    init(_ctx: Context, _options: FeatureOptions): void | Promise<any>;
    PostConstruct(this: any, _ctx: any): void;
    PostConstructEntity(this: any, _ctx: any): void;
    SetData(this: any, _ctx: any): void;
    GetData(this: any, _ctx: any): void;
    SetMatch(this: any, _ctx: any): void;
    GetMatch(this: any, _ctx: any): void;
    PrePoint(this: any, _ctx: any): void;
    PreSpec(this: any, _ctx: any): void;
    PreRequest(this: any, _ctx: any): void;
    PreResponse(this: any, _ctx: any): void;
    PreResult(this: any, _ctx: any): void;
    PreDone(this: any, _ctx: any): void;
    PreUnexpected(this: any, _ctx: any): void;
}
export { BaseFeature };

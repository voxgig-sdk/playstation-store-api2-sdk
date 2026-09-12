import { ContainerEntity } from './entity/ContainerEntity';
export type * from './PlaystationStoreApi2Types';
import { inspect } from 'node:util';
import type { Context, Feature } from './types';
import { config } from './Config';
import { PlaystationStoreApi2EntityBase } from './PlaystationStoreApi2EntityBase';
import { Utility } from './utility/Utility';
import { BaseFeature } from './feature/base/BaseFeature';
declare const stdutil: Utility;
declare class PlaystationStoreApi2SDK {
    _mode: string;
    _options: any;
    _utility: Utility;
    _features: Feature[];
    _rootctx: Context;
    constructor(options?: any);
    options(): any;
    utility(): any;
    prepare(fetchargs?: any): Promise<any>;
    direct(fetchargs?: any): Promise<Error | {
        ok: boolean;
        status: number;
        headers: any;
        data: any;
        err?: undefined;
    } | {
        ok: boolean;
        err: any;
        status?: undefined;
        headers?: undefined;
        data?: undefined;
    }>;
    _rawRequest(fetchargs?: any): Promise<Error | {
        ok: boolean;
        status: number;
        headers: any;
        data: any;
        err?: undefined;
    } | {
        ok: boolean;
        err: any;
        status?: undefined;
        headers?: undefined;
        data?: undefined;
    }>;
    graphql(query: string, variables?: any, ctrl?: any): Promise<any>;
    Container(entopts?: Record<string, any>): ContainerEntity;
    static test(testoptsarg?: any, sdkoptsarg?: any): PlaystationStoreApi2SDK;
    tester(testopts?: any, sdkopts?: any): PlaystationStoreApi2SDK;
    toJSON(): {
        name: string;
    };
    toString(): string;
    [inspect.custom](): string;
}
declare const SDK: typeof PlaystationStoreApi2SDK;
export { stdutil, config, BaseFeature, PlaystationStoreApi2EntityBase, PlaystationStoreApi2SDK, SDK, };

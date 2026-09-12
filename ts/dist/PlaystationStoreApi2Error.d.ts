import { Context } from './Context';
declare class PlaystationStoreApi2Error extends Error {
    isPlaystationStoreApi2Error: boolean;
    sdk: string;
    code: string;
    ctx: Context;
    status: number;
    get notFound(): boolean;
    constructor(code: string, msg: string, ctx: Context);
}
export { PlaystationStoreApi2Error };

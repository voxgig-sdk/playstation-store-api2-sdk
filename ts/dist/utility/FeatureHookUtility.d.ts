import { Context } from '../types';
declare function featureHook(ctx: Context, name: string): Promise<any[]> | undefined;
export { featureHook };

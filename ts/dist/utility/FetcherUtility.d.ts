import { Context, Response } from '../types';
declare function fetcher(ctx: Context, fullurl: string, fetchdef: Record<string, any>): Promise<Response | Error>;
export { fetcher };

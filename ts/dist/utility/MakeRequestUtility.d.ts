import { Context, Response } from '../types';
declare function makeRequest(ctx: Context): Promise<Response | Error>;
export { makeRequest };

import { Context, Response } from '../types';
declare function makeResponse(ctx: Context): Promise<Response | Error>;
export { makeResponse };

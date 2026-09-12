declare class Result {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
    err?: any;
    resdata?: any;
    resmatch?: any;
    constructor(resmap: Record<string, any>);
}
export { Result, };

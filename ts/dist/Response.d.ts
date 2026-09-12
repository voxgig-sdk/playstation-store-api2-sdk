declare class Response {
    status: number;
    statusText: string;
    headers: any;
    json: Function;
    err?: Error;
    body?: any;
    constructor(resmap: Record<string, any>);
}
export { Response, };

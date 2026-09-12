declare class Spec {
    parts: string[];
    headers: Record<string, string>;
    alias: any;
    base: string;
    prefix: string;
    suffix: string;
    params: Record<string, string>;
    query: Record<string, string>;
    step: string;
    method: string;
    body: any;
    url?: string;
    path?: string;
    constructor(specmap: Record<string, any>);
}
export { Spec, };

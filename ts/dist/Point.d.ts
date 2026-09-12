declare class Point {
    args: {
        params: any[];
    };
    kind: string;
    graphql?: any;
    rename: {
        params: Record<string, string>;
    };
    method: string;
    orig: string;
    parts: string[];
    params: string[];
    select: any;
    active: boolean;
    relations: any[];
    alias: Record<string, string>;
    transform: {
        req: any;
        res: any;
    };
    constructor(altmap: Record<string, any>);
}
export { Point, };

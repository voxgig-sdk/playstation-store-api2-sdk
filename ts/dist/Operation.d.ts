import { Point } from './Point';
declare class Operation {
    entity: string;
    name: string;
    input: string;
    points: Point[];
    constructor(opmap: Record<string, any>);
}
export { Operation, };

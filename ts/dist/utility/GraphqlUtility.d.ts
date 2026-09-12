import { Context } from '../types';
declare const GRAPHQL_CONTENT_TYPE = "application/json";
declare function graphqlErrorCode(gqlerr: any): string;
declare function graphqlBody(ctx: Context): any;
declare function graphqlErrors(ctx: Context): boolean;
export { graphqlBody, graphqlErrors, graphqlErrorCode, GRAPHQL_CONTENT_TYPE, };

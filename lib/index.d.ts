/// <reference types="node" />
declare module "lib/graph_utils" {
    export function getWhereCypher(params: any, json: any, variableName: any): Promise<string>;
    export function getOrderCypher(json: any, variable: any): string;
    export function getPaginationCypher(json: any, params: any): string;
    export function getWith(variables: any): string;
}
declare module "lib/query_utils" {
    export const id: unique symbol;
    export const queryKeys: {
        _skip: boolean;
        _limit: boolean;
        _order: boolean;
        _where: boolean;
        _sqlWhere: boolean;
        _id: boolean;
        _label: boolean;
    };
    export function validateLabel(label: any): void;
    export function isPrimitive(value: any): any;
    export function getNodesAndRelationships(json: any, options?: any): {
        objects: {};
        rootObject: any;
        root: any;
        nodes: {};
        relationships: any[];
    };
    export function getIndexesPerNode(nodes: any): {};
    export function parameterize(params: any, value: any): string;
}
declare module "lib/sql_utils" {
    export function getWhereSql(params: any, json: any, variableName: any): any;
    export function handleSql(node: any, customProjection: PropertyMap, sqlQueryParts: any): void;
}
declare module "lib/common_utils" {
    export function getFinalQuery(nodes: any, cypher: any, options: any): string;
    export function queryObjectToCypher(queryObject: any, options: any, eventEmitter: any, getQueryEnd: any): Promise<any>;
    export function handleColumn(column: any, nodes: any, nodesPerKonektoId: any, relationships: any, options: any): Promise<any>;
}
declare module "lib/parser" {
    import { EventEmitter } from 'events';
    export class Parser extends EventEmitter {
        jsonToCypherWrite(json: any, options?: any): Promise<{
            cypher: {
                rootKey: string;
                query: string;
                params: any[];
                graph: {
                    objects: {};
                    rootObject: any;
                    root: any;
                    nodes: {};
                    relationships: any[];
                };
            };
            sql: any;
        }>;
        getFinalQuery(nodes: any, cypher: any, options: any): string;
        jsonToCypherRead(json: any, options: any): Promise<any>;
        jsonToCypherDelete(json: any, options: any): Promise<any>;
        jsonToCypherRelationshipDelete(json: any, options: any): Promise<any>;
        getSchema(json: any): {
            relationshipNames: any[];
            nodeLabels: any[];
        };
        parseRows(rows: any, rootKey: any, options?: {}): Promise<any[]>;
    }
}
declare module "lib/index" {
    class Konekto {
        client: any;
        plugins: any[];
        sqlMappings: PropertyMap;
        /**
         *
         * @param {import('pg').ClientConfig | string} clientConfig
         */
        constructor(clientConfig?: {
            database: string;
            user: string;
            password: string;
        });
        connect(): any;
        /**
         *
         * @param {import('konekto').PropertyMap} mappings
         */
        setSqlMappings(mappings: any): void;
        createSchema(jsonOrArray: any): Promise<any>;
        createLabel(label: any): Promise<import("pg").QueryArrayResult<any[]>> | Promise<import("pg").QueryArrayResult<any[]>>[];
        createRelationship(name: any): Promise<import("pg").QueryArrayResult<any[]>> | Promise<import("pg").QueryArrayResult<any[]>>[];
        /**
         * @param {any} label
         * @param {any} property
         * @param {import('konekto').CreateIndexOptions} options
         */
        createIndex(label: any, property: any, options?: any): Promise<import("pg").QueryArrayResult<any[]>>;
        dropIndex(label: any, property: any, options: any): Promise<void>;
        raw({ query, params }: {
            query: any;
            params?: any;
        }, options?: any): Promise<any[] | import("pg").QueryArrayResult<any[]>>;
        save(json: any, options?: {}): Promise<any>;
        findByQueryObject(queryObject: any, options?: {}): Promise<any>;
        findOneByQueryObject(queryObject: any, options?: {}): Promise<any>;
        findById(id: any, options?: {}): Promise<any>;
        deleteByQueryObject(queryObject: any, options?: {}): Promise<any>;
        deleteById(id: any, options: any): Promise<any>;
        deleteRelationshipsByQueryObject(queryObject: any, options: any): Promise<any>;
        /**
         * @param {string} graphName
         */
        createGraph(graphName: any): Promise<void>;
        /**
         * @param {string} graphName
         */
        setGraph(graphName: any): Promise<void>;
        disconnect(): any;
    }
    export default Konekto;
}
declare module "test/find.test" { }
declare module "test/find_sql.test" { }
declare module "test/hooks.test" { }
declare module "test/save.test" { }

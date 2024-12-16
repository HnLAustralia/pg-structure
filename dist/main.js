"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserialize = exports.pgStructure = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const pg_1 = require("pg");
const pg_connection_string_1 = require("pg-connection-string");
const dotenv_1 = __importDefault(require("dotenv"));
const index_1 = require("./types/index");
const helper_1 = require("./util/helper");
const db_1 = __importDefault(require("./pg-structure/db"));
const schema_1 = __importDefault(require("./pg-structure/schema"));
const domain_1 = __importDefault(require("./pg-structure/type/domain"));
const enum_type_1 = __importDefault(require("./pg-structure/type/enum-type"));
const base_type_1 = __importDefault(require("./pg-structure/type/base-type"));
const composite_type_1 = __importDefault(require("./pg-structure/type/composite-type"));
const table_1 = __importDefault(require("./pg-structure/entity/table"));
const view_1 = __importDefault(require("./pg-structure/entity/view"));
const materialized_view_1 = __importDefault(require("./pg-structure/entity/materialized-view"));
const sequence_1 = __importDefault(require("./pg-structure/entity/sequence"));
const column_1 = __importDefault(require("./pg-structure/column"));
const pg_structure_1 = __importDefault(require("./pg-structure"));
const primary_key_1 = __importDefault(require("./pg-structure/constraint/primary-key"));
const unique_constraint_1 = __importDefault(require("./pg-structure/constraint/unique-constraint"));
const check_constraint_1 = __importDefault(require("./pg-structure/constraint/check-constraint"));
const exclusion_constraint_1 = __importDefault(require("./pg-structure/constraint/exclusion-constraint"));
const foreign_key_1 = __importDefault(require("./pg-structure/constraint/foreign-key"));
const range_type_1 = __importDefault(require("./pg-structure/type/range-type"));
const multi_range_type_1 = __importDefault(require("./pg-structure/type/multi-range-type"));
const normal_function_1 = __importDefault(require("./pg-structure/function/normal-function"));
const procedure_1 = __importDefault(require("./pg-structure/function/procedure"));
const aggregate_function_1 = __importDefault(require("./pg-structure/function/aggregate-function"));
const window_function_1 = __importDefault(require("./pg-structure/function/window-function"));
const pseudo_type_1 = __importDefault(require("./pg-structure/type/pseudo-type"));
const trigger_1 = __importDefault(require("./pg-structure/trigger"));
const naming_function_1 = __importDefault(require("./util/naming-function"));
dotenv_1.default.config();
/**
 * Returns database name.
 *
 * @ignore
 * @param pgClientOrConfig is input to get database name from.
 * @returns database name.
 */
/* istanbul ignore next */
function getDatabaseName(pgClientOrConfig) {
    if (!pgClientOrConfig || pgClientOrConfig instanceof pg_1.Client) {
        return "database";
    }
    return (typeof pgClientOrConfig === "string" ? (0, pg_connection_string_1.parse)(pgClientOrConfig).database : pgClientOrConfig.database) || "database";
}
/**
 * Returns list of schemes in database. If no patterns are given returns all schemas except system schemas.
 * Patterns are feeded to `LIKE` operator of SQL, so `%` and `_` may be used.
 *
 * @ignore
 * @param client is pg client.
 * @param include is pattern to be used in SQL query `LIKE` part.
 * @param exclude is pattern to be used in SQL query `NOT LIKE` part.
 * @param system is whether to include system schemas in result.
 * @returns array of objects describing schemas.
 */
async function getSchemas(client, { include = [], exclude = [], system = false }) {
    const where = ["NOT pg_is_other_temp_schema(oid)", "nspname <> 'pg_toast'"];
    const whereInclude = [];
    const parameters = [];
    const includedPatterns = include.concat(system && include.length > 0 ? ["information\\_schema", "pg\\_%"] : []);
    const excludedPatterns = exclude.concat(system ? [] : ["information\\_schema", "pg\\_%"]);
    includedPatterns.forEach((pattern, i) => {
        whereInclude.push(`nspname LIKE $${i + 1}`); // nspname LIKE $1
        parameters.push(pattern);
    });
    if (whereInclude.length > 0)
        where.push(`(${whereInclude.join(" OR ")})`);
    excludedPatterns.forEach((pattern, i) => {
        where.push(`nspname NOT LIKE $${i + include.length + 1}`); // nspname NOT LIKE $2
        parameters.push(pattern);
    });
    const whereQuery = `WHERE ${where.join(" AND ")}`;
    const sql = `SELECT oid, nspname AS name, obj_description(oid, 'pg_namespace') AS comment FROM pg_namespace ${whereQuery} ORDER BY nspname`;
    const result = await client.query(sql, parameters);
    return result.rows;
}
/**
 * Returns list of system schames required by pg-structure.
 * Patterns are feeded to `LIKE` operator of SQL, so `%` and `_` may be used.
 *
 * @ignore
 * @param client is pg client.
 * @returns array of objects describing schemas.
 */
async function getSystemSchemas(client) {
    const sql = `SELECT oid, nspname AS name, obj_description(oid, 'pg_namespace') AS comment FROM pg_namespace WHERE nspname IN ('pg_catalog') ORDER BY nspname`;
    return (await client.query(sql)).rows;
}
/**
 * Adds system schemas required by pg-structure.
 *
 * @ignore
 * @param db is Db object.
 */
function addSystemSchemas(db, rows) {
    rows.forEach((row) => db.systemSchemas.push(new schema_1.default({ ...row, db })));
}
/**
 * Adds schema instances to database.
 *
 * @ignore
 * @param db is Db object.
 */
function addSchemas(db, rows) {
    rows.forEach((row) => db.schemas.push(new schema_1.default({ ...row, db })));
}
const builtinTypeAliases = {
    int2: { name: "smallint" },
    int4: { name: "integer", shortName: "int" },
    int8: { name: "bigint" },
    numeric: { internalName: "decimal", hasPrecision: true, hasScale: true },
    float4: { name: "real" },
    float8: { name: "double precision" },
    varchar: { name: "character varying", hasLength: true },
    char: { name: "character", hasLength: true },
    timestamp: { name: "timestamp without time zone", hasPrecision: true },
    timestamptz: { name: "timestamp with time zone", hasPrecision: true },
    time: { name: "time without time zone", hasPrecision: true },
    timetz: { name: "time with time zone", hasPrecision: true },
    interval: { hasPrecision: true },
    bool: { name: "boolean" },
    bit: { hasLength: true },
    varbit: { name: "bit varying", hasLength: true },
};
/**
 * Adds types to database.
 *
 * @ignore
 * @param db  is DB object
 * @param rows are query result of types to be added.
 */
function addTypes(db, rows) {
    const typeKinds = { d: domain_1.default, e: enum_type_1.default, b: base_type_1.default, c: composite_type_1.default, r: range_type_1.default, p: pseudo_type_1.default, m: multi_range_type_1.default }; // https://www.postgresql.org/docs/9.5/catalog-pg-type.html
    rows.forEach((row) => {
        const schema = db.systemSchemas.getMaybe(row.schemaOid, { key: "oid" }) || db.schemas.get(row.schemaOid, { key: "oid" });
        const builtinTypeData = builtinTypeAliases[row.name] ? { internalName: row.name, ...builtinTypeAliases[row.name] } : {};
        const kind = row.kind;
        const type = new typeKinds[kind]({ ...row, ...builtinTypeData, schema, sqlType: row.sqlType }); // Only domain type has `sqlType` and it's required.
        schema.typesIncludingEntities.push(type);
    });
}
/**
 * Adds entities to database.
 *
 * @ignore
 * @param db  is DB object
 * @param rows are query result of entities to be added.
 */
function addEntities(db, rows) {
    rows.forEach((row) => {
        const schema = db.schemas.get(row.schemaOid, { key: "oid" });
        /* istanbul ignore else */
        if (row.kind === "r" || row.kind === "p")
            schema.tables.push(new table_1.default({ ...row, schema }));
        else if (row.kind === "v")
            schema.views.push(new view_1.default({ ...row, schema }));
        else if (row.kind === "m")
            schema.materializedViews.push(new materialized_view_1.default({ ...row, schema }));
        else if (row.kind === "S")
            schema.sequences.push(new sequence_1.default({ ...row, schema }));
    });
}
/**
 * Adds columns to database.
 *
 * @ignore
 * @param db  is DB object
 * @param rows are query result of columns to be added.
 */
function addColumns(db, rows) {
    rows.forEach((row) => {
        const parent = (row.parentKind === "c"
            ? db.typesIncludingEntities.get(row.parentOid, { key: "classOid" })
            : db.entities.get(row.parentOid, { key: "oid" }));
        parent.columns.push(new column_1.default({ parent, ...row }));
    });
}
/**
 * Adds indexes to database.
 *
 * @ignore
 * @param db  is DB object
 * @param rows are query result of indexes to be added.
 */
function addIndexes(db, rows) {
    rows.forEach((row) => {
        const parent = db.entities.get(row.tableOid, { key: "oid" });
        const index = new pg_structure_1.default({ ...row, parent });
        const indexExpressions = [...row.indexExpressions]; // Non column reference index expressions.
        row.columnPositions.forEach((position) => {
            // If position is 0, then it's an index attribute that is not simple column references. It is an expression which is stored in indexExpressions.
            const columnOrExpression = (position > 0 ? parent.columns.find((c) => c.attributeNumber === position) : indexExpressions.shift());
            index.columnsAndExpressions.push(columnOrExpression);
        });
        parent.indexes.push(index);
    });
}
/**
 * Add functions to database.
 *
 * @ignore
 * @param db is DB object.
 * @param rows are query result of functions to be added.
 */
function addFunctions(db, rows) {
    rows.forEach((row) => {
        const schema = db.schemas.get(row.schemaOid, { key: "oid" });
        /* istanbul ignore else */
        if (row.kind === "f")
            schema.normalFunctions.push(new normal_function_1.default({ ...row, schema }));
        else if (row.kind === "p")
            schema.procedures.push(new procedure_1.default({ ...row, schema }));
        else if (row.kind === "a")
            schema.aggregateFunctions.push(new aggregate_function_1.default({ ...row, schema }));
        else if (row.kind === "w")
            schema.windowFunctions.push(new window_function_1.default({ ...row, schema }));
    });
}
/**
 *
 * @ignore
 * @param db is DB object.
 * @param rows are query result of triggers to be added.
 */
function addTriggers(db, rows) {
    rows.forEach((row) => {
        const entity = db.entities.get(row.entityOid, { key: "oid" });
        const func = db.functions.get(row.functionOid, { key: "oid" });
        entity.triggers.push(new trigger_1.default({ ...row, function: func, parent: entity }));
    });
}
/**
 * Adds constraints to database.
 *
 * @ignore
 * @param db  is DB object
 * @param rows are query result of constraints to be added.
 */
function addConstraints(db, rows) {
    const actionLetterMap = {
        a: "NO ACTION" /* Action.NoAction */,
        r: "RESTRICT" /* Action.Restrict */,
        c: "CASCADE" /* Action.Cascade */,
        n: "SET NULL" /* Action.SetNull */,
        d: "SET DEFAULT" /* Action.SetDefault */,
    };
    const matchTypeLetterMap = {
        f: index_1.MatchType.Full,
        p: index_1.MatchType.Partial,
        s: index_1.MatchType.Simple,
    };
    rows.forEach((row) => {
        const table = db.tables.getMaybe(row.tableOid, { key: "oid" });
        const index = db.indexes.getMaybe(row.indexOid, { key: "oid" });
        const domain = db.typesIncludingEntities.getMaybe(row.typeOid, { key: "oid" });
        /* istanbul ignore else */
        if (table) {
            /* istanbul ignore else */
            if (row.kind === "p")
                table.constraints.push(new primary_key_1.default({ ...row, index, table }));
            else if (row.kind === "u")
                table.constraints.push(new unique_constraint_1.default({ ...row, index, table }));
            else if (row.kind === "x")
                table.constraints.push(new exclusion_constraint_1.default({ ...row, index, table }));
            else if (row.kind === "c")
                table.constraints.push(new check_constraint_1.default({ ...row, table, expression: row.checkConstraintExpression }));
            else if (row.kind === "f") {
                if (index === undefined)
                    return;
                const foreignKey = new foreign_key_1.default({
                    ...row,
                    table,
                    index,
                    columns: row.constrainedColumnPositions.map((pos) => table.columns.get(pos, { key: "attributeNumber" })),
                    onUpdate: actionLetterMap[row.onUpdate],
                    onDelete: actionLetterMap[row.onDelete],
                    matchType: matchTypeLetterMap[row.matchType],
                });
                table.constraints.push(foreignKey);
                foreignKey.referencedTable.foreignKeysToThis.push(foreignKey);
            }
        }
        else if (domain) {
            /* istanbul ignore else */
            if (row.kind === "c") {
                domain.checkConstraints.push(new check_constraint_1.default({ ...row, domain, expression: row.checkConstraintExpression }));
            }
        }
    });
}
/**
 * Returns results of SQL queries of meta data.
 *
 * @ignore
 */
async function getQueryResultsFromDb(serverVersion, client, includeSchemasArray, excludeSchemasArray, includeSystemSchemas
// ): Promise<QueryResults> {
) {
    const schemaRows = await getSchemas(client, { include: includeSchemasArray, exclude: excludeSchemasArray, system: includeSystemSchemas });
    const systemSchemaRows = await getSystemSchemas(client);
    const schemaOids = schemaRows.map((schema) => schema.oid);
    const schemaOidsIncludingSystem = schemaOids.concat(systemSchemaRows.map((schema) => schema.oid));
    const queryVersions = await (0, helper_1.getQueryVersionFor)(serverVersion);
    return Promise.all([
        schemaRows,
        systemSchemaRows,
        (0, helper_1.executeSqlFile)(queryVersions, "type", client, schemaOidsIncludingSystem),
        (0, helper_1.executeSqlFile)(queryVersions, "entity", client, schemaOids),
        (0, helper_1.executeSqlFile)(queryVersions, "column", client, schemaOids),
        (0, helper_1.executeSqlFile)(queryVersions, "index", client, schemaOids),
        (0, helper_1.executeSqlFile)(queryVersions, "constraint", client, schemaOids),
        (0, helper_1.executeSqlFile)(queryVersions, "function", client, schemaOids),
        (0, helper_1.executeSqlFile)(queryVersions, "trigger", client, schemaOids),
    ]);
}
/**
 * Adds database objects to database.
 *
 * @ignore
 * @param db  is DB object
 * @param queryResults are query results to get object details from.
 */
function addObjects(db, queryResults) {
    addSchemas(db, queryResults[0]);
    addSystemSchemas(db, queryResults[1]);
    addTypes(db, queryResults[2]);
    addEntities(db, queryResults[3]);
    addColumns(db, queryResults[4]);
    addIndexes(db, queryResults[5]);
    addConstraints(db, queryResults[6]);
    addFunctions(db, queryResults[7]);
    addTriggers(db, queryResults[8]);
}
/**
 * Checks whether given object are options for the `pgStructure` function.
 *
 * @param input is the input to check.
 * @returns whether given input are options for the `pgStructure` function.
 */
function isOptions(input) {
    /* istanbul ignore next */
    if (input === undefined)
        return false;
    const optionsAvailable = {
        envPrefix: true,
        name: true,
        commentDataToken: true,
        includeSchemas: true,
        excludeSchemas: true,
        includeSystemSchemas: true,
        foreignKeyAliasSeparator: true,
        foreignKeyAliasTargetFirst: true,
        relationNameFunctions: true,
        keepConnection: true,
    };
    return Object.keys(input).some((key) => Object.prototype.hasOwnProperty.call(optionsAvailable, key));
}
async function pgStructure(clientOrOptions, maybeOptions = {}) {
    const [maybePgClientOrConfig, options] = isOptions(clientOrOptions) ? [undefined, clientOrOptions] : [clientOrOptions, maybeOptions];
    /* istanbul ignore next */
    const pgClientOrConfig = maybePgClientOrConfig ?? (0, helper_1.getEnvValues)(options.envPrefix ?? "DB");
    const { client, shouldCloseConnection } = await (0, helper_1.getConnectedPgClient)(pgClientOrConfig);
    const serverVersion = (await client.query("SHOW server_version")).rows[0].server_version;
    const queryResults = await getQueryResultsFromDb(serverVersion, client, (0, helper_1.arrify)(options.includeSchemas), (0, helper_1.arrify)(options.excludeSchemas), options.includeSystemSchemas);
    const db = new db_1.default({ name: options.name || getDatabaseName(pgClientOrConfig), serverVersion }, {
        commentDataToken: options.commentDataToken ?? "pg-structure",
        relationNameFunctions: options.relationNameFunctions ?? "short",
        foreignKeyAliasSeparator: options.foreignKeyAliasSeparator ?? ",",
        foreignKeyAliasTargetFirst: options.foreignKeyAliasTargetFirst ?? false,
    }, queryResults, (0, naming_function_1.default)(options.relationNameFunctions ?? "short"));
    addObjects(db, queryResults);
    if (!options.keepConnection && shouldCloseConnection)
        client.end(); // If a connected client is provided, do not close connection.
    return db;
}
exports.pgStructure = pgStructure;
/**
 * Deserializes given data to create [[Db]] object. Please note that custom relation name functions are not serialized.
 * To serialize, provide functions as a module and use them with `{ relationNameFunctions: "my-module" }`.
 *
 * @param serializedData is serialized data of the `Db` object.
 * @returns [[Db]] object for given serialized data.
 * @example
 * import pgStructure, { deserialize } from "pg-structure";
 * const db = await pgStructure({ database: "db", user: "u", password: "pass" });
 * const serialized = db.serialize();
 * const otherDb = deserialize(serialized);
 */
function deserialize(serializedData) {
    const data = JSON.parse(serializedData);
    const db = new db_1.default({ name: data.name, serverVersion: data.serverVersion }, data.config, data.queryResults, (0, naming_function_1.default)(data.config.relationNameFunctions));
    addObjects(db, data.queryResults);
    return db;
}
exports.deserialize = deserialize;
//# sourceMappingURL=main.js.map
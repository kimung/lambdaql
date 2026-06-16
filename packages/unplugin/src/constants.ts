export const GLOBAL_NAMES = new Set(["Math"]);
export const QUERYABLE_METHODS = new Set(["filter", "select", "groupBy", "having", "orderBy", "orderByDesc"]);
export const JOIN_METHODS = new Set(["join", "leftJoin"]);
export const KNOWN_FACTORIES = new Set(["from", "fromRaw", "createDatabase"]);
// Méthodes sur un objet Database (non-Queryable) qui produisent un Queryable
export const DATABASE_METHODS = new Set(["from"]);

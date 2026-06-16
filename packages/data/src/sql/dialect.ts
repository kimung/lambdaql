export type SqlFnName =
  | "mod"
  | "coalesce"
  | "length"
  | "concat"
  | "year"
  | "month"
  | "day"
  | "dayofweek"
  | "hour"
  | "minute"
  | "second"
  | "floor"
  | "ceil"
  | "round"
  | "abs";

export interface Dialect {
  readonly name: string;
  /** Retourne le placeholder pour le n-ième paramètre (index 1-based). */
  placeholder(index: number): string;
  /** Décale les placeholders numérotés d'un SQL généré par un child translator. Identité pour les dialectes à '?'. */
  reindex(sql: string, offset: number): string;
  /** Clause LIMIT / OFFSET selon les contraintes du dialecte. */
  limitOffset(limit?: number, skip?: number): string;
  /** Appel de fonction SQL portable. */
  fn(name: SqlFnName, args: string[]): string;
  /** Quoting d'un identifiant (réservé pour une option future). */
  quoteIdent(ident: string): string;
}

function standardFn(name: SqlFnName, args: string[]): string {
  switch (name) {
    case "mod":
      return `MOD(${args[0]}, ${args[1]})`;
    case "coalesce":
      return `COALESCE(${args[0]}, ${args[1]})`;
    case "length":
      return `LENGTH(${args[0]})`;
    case "year":
      return `EXTRACT(YEAR FROM ${args[0]})`;
    case "month":
      return `EXTRACT(MONTH FROM ${args[0]})`;
    case "day":
      return `EXTRACT(DAY FROM ${args[0]})`;
    case "dayofweek":
      return `EXTRACT(DOW FROM ${args[0]})`;
    case "hour":
      return `EXTRACT(HOUR FROM ${args[0]})`;
    case "minute":
      return `EXTRACT(MINUTE FROM ${args[0]})`;
    case "second":
      return `EXTRACT(SECOND FROM ${args[0]})`;
    case "floor":
      return `FLOOR(${args[0]})`;
    case "ceil":
      return `CEIL(${args[0]})`;
    case "round":
      return `ROUND(${args[0]})`;
    case "abs":
      return `ABS(${args[0]})`;
    case "concat":
      return args.join(" || ");
  }
}

export const postgres: Dialect = {
  name: "postgres",
  placeholder: (i) => `$${i}`,
  reindex: (sql, offset) => (offset === 0 ? sql : sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n, 10) + offset}`)),
  limitOffset: (limit, skip) => `${limit != null ? ` LIMIT ${limit}` : ""}${skip != null ? ` OFFSET ${skip}` : ""}`,
  fn: standardFn,
  quoteIdent: (id) => `"${id.replace(/"/g, '""')}"`,
};

export const mysql: Dialect = {
  name: "mysql",
  placeholder: () => "?",
  reindex: (sql) => sql,
  limitOffset: (limit, skip) => {
    if (limit != null && skip != null) return ` LIMIT ${limit} OFFSET ${skip}`;
    if (limit != null) return ` LIMIT ${limit}`;
    // MySQL exige un LIMIT quand OFFSET est utilisé seul
    if (skip != null) return ` LIMIT 18446744073709551615 OFFSET ${skip}`;
    return "";
  },
  fn(name, args) {
    if (name === "concat") return `CONCAT(${args.join(", ")})`;
    return standardFn(name, args);
  },
  quoteIdent: (id) => `\`${id.replace(/`/g, "``")}\``,
};

export const sqlite: Dialect = {
  name: "sqlite",
  placeholder: () => "?",
  reindex: (sql) => sql,
  limitOffset: (limit, skip) => {
    if (limit != null && skip != null) return ` LIMIT ${limit} OFFSET ${skip}`;
    if (limit != null) return ` LIMIT ${limit}`;
    if (skip != null) return ` LIMIT -1 OFFSET ${skip}`;
    return "";
  },
  fn(name, args) {
    // SQLite: dates via strftime, math via les fonctions standard (disponibles en mode RTREE/MATH depuis 3.35)
    switch (name) {
      case "year":
        return `CAST(strftime('%Y', ${args[0]}) AS INTEGER)`;
      case "month":
        return `CAST(strftime('%m', ${args[0]}) AS INTEGER)`;
      case "day":
        return `CAST(strftime('%d', ${args[0]}) AS INTEGER)`;
      case "dayofweek":
        return `CAST(strftime('%w', ${args[0]}) AS INTEGER)`;
      case "hour":
        return `CAST(strftime('%H', ${args[0]}) AS INTEGER)`;
      case "minute":
        return `CAST(strftime('%M', ${args[0]}) AS INTEGER)`;
      case "second":
        return `CAST(strftime('%S', ${args[0]}) AS INTEGER)`;
      default:
        return standardFn(name, args);
    }
  },
  quoteIdent: (id) => `"${id.replace(/"/g, '""')}"`,
};

export interface SqlWindowSpec {
  partitionBy?: unknown;
  orderBy?: unknown;
  orderByDesc?: unknown;
}

export type SqlAggResult = number & {
  over(spec: SqlWindowSpec): number;
};

export type SqlNumber = number & {
  sum(): SqlAggResult;
  avg(): SqlAggResult;
  min(): SqlAggResult;
  max(): SqlAggResult;
  count(): SqlAggResult;
  rank(): SqlAggResult;
  denseRank(): SqlAggResult;
  rowNumber(): SqlAggResult;
};

export type SqlString = string & {
  toLowerCase(): SqlString;
  toUpperCase(): SqlString;
  trim(): SqlString;
};

export type SqlDate = Date & {
  getFullYear(): SqlNumber;
  getMonth(): SqlNumber;
  getDate(): SqlNumber;
  getDay(): SqlNumber;
  getHours(): SqlNumber;
  getMinutes(): SqlNumber;
  getSeconds(): SqlNumber;
};

type SqlPrimitive<T> = T extends number ? SqlNumber : T extends string ? SqlString : T extends Date ? SqlDate : T;

export type SqlEntity<T> = {
  [K in keyof T]: SqlPrimitive<T[K]>;
};

// Paramètre lambda — SqlEntity<T> enrichi de count() pour COUNT(*) via e.count()
export type SqlRow<T> = SqlEntity<T> & {
  count(): SqlAggResult;
};

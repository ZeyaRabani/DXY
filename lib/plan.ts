// Pure, shared types for query plans. No server-only imports so this can be used
// by the deterministic parser, the API routes, and (read-only) the client UI.
import type { SourceId } from "./datasets";

export type FilterOp = "eq" | "neq" | "gte" | "lte" | "between" | "in";

export interface Filter {
  field: string;
  op: FilterOp;
  value: string | number | boolean | Array<string | number>;
}

export interface QueryPlan {
  dataset: SourceId;
  targetField?: string;
  filters: Filter[];
}

export interface DistributionRow {
  value: string;
  count: number;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

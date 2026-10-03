export type JsonSchemaCheck = { type: 'json-schema'; schema: object };

export type CountCheck = { type: 'count'; path?: string; equals: number };

export type ContainsAllCheck = {
  type: 'contains-all';
  path?: string;
  key: string;
  field: string;
  terms: Record<string, string[]>;
};

export type Sha256Check = { type: 'sha256'; equals: string };

export type Check = JsonSchemaCheck | CountCheck | ContainsAllCheck | Sha256Check;

export type Spec = {
  version: 1;
  title: string;
  description?: string;
  checks: Check[];
};

export type CheckResult = {
  type: Check['type'] | 'integrity';
  passed: boolean;
  detail: string;
};

export type Verdict = { passed: boolean; results: CheckResult[] };

/** What a check sees: the parsed deliverable and the hash of its raw bytes. */
export type Deliverable = { data: unknown; hash: string };

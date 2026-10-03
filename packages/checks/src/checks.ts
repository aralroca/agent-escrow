import { Ajv } from 'ajv';
import type {
  Check,
  CheckResult,
  ContainsAllCheck,
  CountCheck,
  Deliverable,
  JsonSchemaCheck,
  Sha256Check,
} from './types.ts';

type Item = Record<string, unknown>;

const ajv = new Ajv({ allErrors: true, strict: false });
const MAX_LISTED = 3;

function at(data: unknown, path = ''): unknown {
  return path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((node, key) => (node as Item | undefined)?.[key], data);
}

function listAt(data: unknown, path?: string): Item[] | undefined {
  const node = at(data, path);

  return Array.isArray(node) ? node : undefined;
}

function jsonSchema(check: JsonSchemaCheck, { data }: Deliverable): CheckResult {
  const validate = ajv.compile(check.schema);
  const passed = validate(data);
  const errors = validate.errors?.slice(0, MAX_LISTED);
  const detail = passed ? 'Deliverable matches the schema' : ajv.errorsText(errors);

  return { type: check.type, passed, detail };
}

function count(check: CountCheck, { data }: Deliverable): CheckResult {
  const items = listAt(data, check.path);
  const detail = items ? `${items.length} / ${check.equals} items` : 'Deliverable is not a list';

  return { type: check.type, passed: items?.length === check.equals, detail };
}

function missingTerms(check: ContainsAllCheck, items: Item[]): string[] {
  const textByKey = new Map(
    items.map((item) => [String(item[check.key]), String(item[check.field] ?? '')]),
  );

  return Object.entries(check.terms).flatMap(([key, terms]) =>
    terms.filter((term) => !textByKey.get(key)?.includes(term)).map((term) => `${key}: ${term}`),
  );
}

function containsAll(check: ContainsAllCheck, { data }: Deliverable): CheckResult {
  const missing = missingTerms(check, listAt(data, check.path) ?? []);
  const listed = missing.slice(0, MAX_LISTED).join(', ');
  const detail = missing.length
    ? `${missing.length} required terms missing (${listed})`
    : 'All required terms present';

  return { type: check.type, passed: missing.length === 0, detail };
}

function sha256(check: Sha256Check, { hash }: Deliverable): CheckResult {
  const passed = hash === check.equals.toLowerCase();
  const detail = passed ? 'Content hash matches' : `Content hash is ${hash}`;

  return { type: check.type, passed, detail };
}

const RUNNERS = { 'json-schema': jsonSchema, count, 'contains-all': containsAll, sha256 };

export function runCheck(check: Check, deliverable: Deliverable): CheckResult {
  const runner = RUNNERS[check.type] as (check: Check, deliverable: Deliverable) => CheckResult;

  return runner(check, deliverable);
}

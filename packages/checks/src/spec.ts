import { Ajv } from 'ajv';
import type { Spec } from './types.ts';

const text = { type: 'string', minLength: 1 };
const CHECK_SCHEMAS = [
  {
    properties: { type: { const: 'json-schema' }, schema: { type: 'object' } },
    required: ['schema'],
  },
  {
    properties: { type: { const: 'count' }, path: text, equals: { type: 'integer', minimum: 0 } },
    required: ['equals'],
  },
  {
    properties: {
      type: { const: 'contains-all' },
      path: text,
      key: text,
      field: text,
      terms: { type: 'object', additionalProperties: { type: 'array', items: text } },
    },
    required: ['key', 'field', 'terms'],
  },
  {
    properties: {
      type: { const: 'sha256' },
      equals: { type: 'string', pattern: '^[0-9a-fA-F]{64}$' },
    },
    required: ['equals'],
  },
];

const SPEC_SCHEMA = {
  type: 'object',
  required: ['version', 'title', 'checks'],
  properties: {
    version: { const: 1 },
    title: text,
    description: { type: 'string' },
    checks: {
      type: 'array',
      minItems: 1,
      items: { type: 'object', required: ['type'], oneOf: CHECK_SCHEMAS },
    },
  },
};

const ajv = new Ajv({ allErrors: true });
const validateSpec = ajv.compile(SPEC_SCHEMA);

export function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/** A JSON Schema that cannot be compiled could never be run, so the spec is refused. */
function assertSchemasCompile(spec: Spec): Spec {
  const schemas = spec.checks.flatMap((check) =>
    check.type === 'json-schema' ? [check.schema] : [],
  );

  try {
    schemas.forEach((schema) => {
      new Ajv({ strict: false }).compile(schema);
    });
  } catch (error) {
    throw new Error(`Invalid acceptance spec: ${(error as Error).message}`);
  }

  return spec;
}

/** Parses and validates an acceptance spec. Throws when it is not a valid v1 spec. */
export function parseSpec(bytes: Uint8Array): Spec {
  const spec = parseJson(bytes);

  if (!validateSpec(spec)) {
    throw new Error(`Invalid acceptance spec: ${ajv.errorsText(validateSpec.errors)}`);
  }

  return assertSchemasCompile(spec as Spec);
}

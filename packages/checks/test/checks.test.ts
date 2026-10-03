import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spec } from '../src/index.ts';
import { evaluate, parseSpec, runChecks, sha256Hex } from '../src/index.ts';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const products = [
  { id: 'sku-1', title: 'Zapatillas Acme Runner' },
  { id: 'sku-2', title: 'Mochila Northwind 20L' },
];
const spec: Spec = {
  version: 1,
  title: 'Translate 2 products',
  checks: [
    {
      type: 'json-schema',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'title'],
          properties: { title: { type: 'string' } },
        },
      },
    },
    { type: 'count', equals: 2 },
    {
      type: 'contains-all',
      key: 'id',
      field: 'title',
      terms: { 'sku-1': ['Acme'], 'sku-2': ['Northwind'] },
    },
  ],
};

describe('runChecks', () => {
  it('passes a deliverable that satisfies every check', async () => {
    const verdict = await runChecks(spec, encode(products));

    expect(verdict.passed).toBe(true);
    expect(verdict.results.map((result) => result.passed)).toEqual([true, true, true]);
  });

  it('fails the count check when rows are missing', async () => {
    const verdict = await runChecks(spec, encode(products.slice(0, 1)));

    expect(verdict.passed).toBe(false);
    expect(verdict.results[1]).toMatchObject({
      type: 'count',
      passed: false,
      detail: '1 / 2 items',
    });
  });

  it('fails the schema check when a field has the wrong type', async () => {
    const verdict = await runChecks(spec, encode([{ id: 'sku-1', title: 7 }, products[1]]));

    expect(verdict.results[0]).toMatchObject({ type: 'json-schema', passed: false });
  });

  it('fails contains-all when a brand term was translated away', async () => {
    const verdict = await runChecks(
      spec,
      encode([{ id: 'sku-1', title: 'Zapatillas' }, products[1]]),
    );

    expect(verdict.results[2]).toMatchObject({ passed: false });
    expect(verdict.results[2].detail).toContain('sku-1: Acme');
  });

  it('fails, without crashing, when items are null or not objects', async () => {
    const verdict = await runChecks(spec, encode([null, 7]));

    expect(verdict.passed).toBe(false);
    expect(verdict.results[2].detail).toContain('2 required terms missing');
  });

  it('fails every structural check when the deliverable is not JSON', async () => {
    const verdict = await runChecks(spec, new TextEncoder().encode('not json'));

    expect(verdict.results.every((result) => !result.passed)).toBe(true);
  });

  it('reads nested lists through a dot path', async () => {
    const nested: Spec = {
      version: 1,
      title: 'nested',
      checks: [{ type: 'count', path: 'data.items', equals: 2 }],
    };
    const verdict = await runChecks(nested, encode({ data: { items: products } }));

    expect(verdict.passed).toBe(true);
  });

  it('compares the sha256 of the raw bytes', async () => {
    const bytes = encode(products);
    const exact: Spec = {
      version: 1,
      title: 'exact',
      checks: [{ type: 'sha256', equals: await sha256Hex(bytes) }],
    };

    expect((await runChecks(exact, bytes)).passed).toBe(true);
    expect((await runChecks(exact, encode([]))).passed).toBe(false);
  });
});

describe('parseSpec', () => {
  it('accepts a valid spec', () => {
    expect(parseSpec(encode(spec)).checks).toHaveLength(3);
  });

  it.each([
    ['not json', new TextEncoder().encode('{')],
    ['no checks', encode({ version: 1, title: 't', checks: [] })],
    ['unknown check type', encode({ version: 1, title: 't', checks: [{ type: 'vibes' }] })],
    ['count without equals', encode({ version: 1, title: 't', checks: [{ type: 'count' }] })],
    ['wrong version', encode({ version: 2, title: 't', checks: [{ type: 'count', equals: 1 }] })],
    [
      'a schema that does not compile',
      encode({
        version: 1,
        title: 't',
        checks: [{ type: 'json-schema', schema: { type: 'strng' } }],
      }),
    ],
  ])('rejects %s', (_name, bytes) => {
    expect(() => parseSpec(bytes)).toThrow('Invalid acceptance spec');
  });
});

describe('evaluate', () => {
  const files = new Map<string, Uint8Array>();
  const serve = (uri: string) =>
    new Response(files.get(uri) as BodyInit | undefined, { status: files.has(uri) ? 200 : 404 });

  async function commit(result: unknown) {
    files.set('https://x/spec', encode(spec));
    files.set('https://x/result', encode(result));
    vi.stubGlobal('fetch', async (uri: string) => serve(uri));

    return {
      specUri: 'https://x/spec',
      specHash: await sha256Hex(encode(spec)),
      resultUri: 'https://x/result',
      resultHash: await sha256Hex(encode(result)),
    };
  }

  afterEach(() => {
    files.clear();
    vi.unstubAllGlobals();
  });

  it('reproduces a passing verdict from the committed hashes', async () => {
    const evaluation = await evaluate(await commit(products));

    expect(evaluation.passed).toBe(true);
    expect(evaluation.spec.title).toBe(spec.title);
  });

  it('fails when the deliverable does not match its committed hash', async () => {
    const commitment = await commit(products);
    const evaluation = await evaluate({ ...commitment, resultHash: 'ab'.repeat(32) });

    expect(evaluation.results).toEqual([
      expect.objectContaining({ type: 'integrity', passed: false }),
    ]);
  });

  it('fails when the deliverable is unreachable', async () => {
    const commitment = await commit(products);
    const evaluation = await evaluate({ ...commitment, resultUri: 'https://x/missing' });

    expect(evaluation.passed).toBe(false);
  });

  it('only downloads over http(s)', async () => {
    const commitment = await commit(products);

    await expect(evaluate({ ...commitment, specUri: 'file:///etc/passwd' })).rejects.toThrow(
      'Only http(s) URLs',
    );
  });

  it('refuses deliverables above the size cap', async () => {
    const commitment = await commit(products);

    files.set('https://x/huge', new Uint8Array(5 * 1024 * 1024 + 1));
    const evaluation = await evaluate({ ...commitment, resultUri: 'https://x/huge' });

    expect(evaluation.results[0].detail).toContain('is larger than');
  });

  it('throws, instead of failing the seller, when the deliverable host is temporarily down', async () => {
    const commitment = await commit(products);

    vi.stubGlobal('fetch', async (uri: string) =>
      uri.endsWith('/result') ? new Response('busy', { status: 503 }) : serve(uri),
    );

    await expect(evaluate(commitment)).rejects.toThrow('HTTP 503');
    expect((await evaluate(commitment, { unreachableFails: true })).passed).toBe(false);
  });

  it('throws when the spec does not match its committed hash', async () => {
    const commitment = await commit(products);

    await expect(evaluate({ ...commitment, specHash: 'ab'.repeat(32) })).rejects.toThrow(
      'committed hash',
    );
  });
});

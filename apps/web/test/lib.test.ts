import { describe, expect, it } from 'vitest';
import { percent, relativeTime, shortAddress } from '../src/lib/format.ts';
import { highlight } from '../src/lib/highlight.ts';

const kinds = (source: string) =>
  highlight(source)
    .filter((token) => token.kind)
    .map((token) => [token.text, token.kind]);

describe('highlight', () => {
  it('keeps every character of the source', () => {
    const source = '{ "a": [1, "two"], // note\n  b: await call(3_000n) }';

    expect(
      highlight(source)
        .map((token) => token.text)
        .join(''),
    ).toBe(source);
  });

  it('tells JSON keys from string values', () => {
    expect(kinds('{ "command": "npx", "max": 50 }')).toEqual([
      ['"command"', 'key'],
      ['"npx"', 'str'],
      ['"max"', 'key'],
      ['50', 'num'],
    ]);
  });

  it('marks keywords, calls, numbers and comments in TypeScript', () => {
    expect(kinds('const job = await createJob(30) // lock')).toEqual([
      ['const', 'key'],
      ['await', 'key'],
      ['createJob', 'fn'],
      ['30', 'num'],
      ['// lock', 'com'],
    ]);
  });

  it('does not colour words inside strings or comments', () => {
    expect(kinds('"const await" // new 42')).toEqual([
      ['"const await"', 'str'],
      ['// new 42', 'com'],
    ]);
  });
});

describe('format', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');

  it.each([
    ['2026-10-03T11:59:30Z', '30 seconds ago'],
    ['2026-10-03T11:55:00Z', '5 minutes ago'],
    ['2026-10-03T09:00:00Z', '3 hours ago'],
    ['2026-10-01T12:00:00Z', '2 days ago'],
    ['2026-10-03T13:00:00Z', 'in 1 hour'],
  ])('describes %s as "%s"', (iso, text) => {
    expect(relativeTime(iso, now)).toBe(text);
  });

  it('shortens addresses and formats rates', () => {
    expect(shortAddress('98UQvVXX8Zm3AGt9V3uiYYTWYFtDUbvEt6MwK2izLhmd')).toBe('98UQ…Lhmd');
    expect(percent(0.9875)).toBe('98.8%');
    expect(percent(undefined)).toBe('—');
  });
});

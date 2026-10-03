type Token = { text: string; kind?: 'key' | 'str' | 'num' | 'com' | 'fn' };

const KEYWORDS = new Set(['const', 'await', 'new', 'import', 'from', 'export', 'async', 'return']);
// Order matters: comments and strings first so their contents are not re-tokenised.
const PATTERN =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d[\d_.]*n?\b)|([A-Za-z_$][\w$]*)/g;

function classify(match: RegExpExecArray, source: string): Token['kind'] {
  const [text, comment, string, number, word] = match;
  const after = source.slice(match.index + text.length);

  if (comment) return 'com';
  if (string) return /^\s*:/.test(after) ? 'key' : 'str';
  if (number) return 'num';
  if (word && KEYWORDS.has(word)) return 'key';

  return word && after.startsWith('(') ? 'fn' : undefined;
}

/** Splits JSON or TypeScript source into coloured tokens. Good enough for short snippets. */
export function highlight(source: string): Token[] {
  const matches = [...source.matchAll(PATTERN)] as RegExpExecArray[];
  const ends = [0, ...matches.map((match) => match.index + match[0].length)];

  return matches
    .flatMap((match, index) => [
      { text: source.slice(ends[index], match.index) },
      { text: match[0], kind: classify(match, source) },
    ])
    .concat({ text: source.slice(ends[matches.length]) })
    .filter((token) => token.text);
}

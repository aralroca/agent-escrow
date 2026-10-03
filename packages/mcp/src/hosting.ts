/** Publishes a JSON document at a public URL and resolves to that URL. */
export type Publish = (name: string, content: unknown) => Promise<string>;

type GistResponse = { files?: Record<string, { raw_url: string }>; message?: string };
type Document = { uri?: string; content?: unknown; name: string; what: string };

const GIST_API = 'https://api.github.com/gists';
const NO_HOSTING =
  'No hosting configured. Pass a public URL instead of inline content, or set GITHUB_TOKEN ' +
  '(with the "gist" scope) so the server can publish the content as a GitHub Gist.';

async function createGist(token: string, name: string, content: unknown): Promise<GistResponse> {
  const files = { [name]: { content: JSON.stringify(content, null, 2) } };
  const response = await fetch(GIST_API, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
    body: JSON.stringify({ description: 'Agent Escrow', public: true, files }),
  });

  return response.json();
}

async function publishGist(token: string, name: string, content: unknown): Promise<string> {
  const gist = await createGist(token, name, content);
  const url = gist.files?.[name]?.raw_url;

  if (!url) throw new Error(`GitHub refused to create the gist: ${gist.message}`);

  return url;
}

/**
 * Specs and deliverables must live at a public URL so anyone can re-run the acceptance test.
 * With a GitHub token the server hosts them as public gists; without one, callers bring a URL.
 */
export function publisher(token?: string): Publish {
  return async function publish(name, content) {
    if (!token) throw new Error(NO_HOSTING);

    return publishGist(token, name, content);
  };
}

/** The public URL of a document given either as a URL or as inline content to publish. */
export async function resolveUri(publish: Publish, document: Document): Promise<string> {
  const { uri, content, name, what } = document;

  if (uri) return uri;
  if (content === undefined) throw new Error(`Provide the ${what} inline or as a public URL.`);

  return publish(name, content);
}

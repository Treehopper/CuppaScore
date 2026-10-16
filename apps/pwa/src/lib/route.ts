/** Minimal hash router: `#/log`, `#/bags/<id>` … (GitHub Pages has no server rewrites). */

export interface Route {
  /** Path without the leading `#`, always starting with `/`. */
  path: string;
  /** Path split into non-empty segments. */
  segments: string[];
  query: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart = '/', queryPart = ''] = raw.split('?', 2);
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return {
    path,
    segments: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: Object.fromEntries(new URLSearchParams(queryPart)),
  };
}

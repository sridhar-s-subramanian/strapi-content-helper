/**
 * Pure Next.js app-router path classifier. Given a page file path relative to the
 * `app/` directory, decide whether it maps to a content model and how.
 *
 * Rules (FR1.1): static route -> single type, dynamic segment -> collection type.
 * Route groups `(x)` are transparent; parallel `@x`, intercepting `(.)x`, catch-all
 * `[...x]`, optional catch-all `[[...x]]`, and private `_x` segments are skipped.
 */

export type RouteResult =
  | { ok: true; kind: 'single' | 'collection'; name: string; segments: string[] }
  | { ok: false; reason: string };

const PAGE_FILE_RE = /^page\.(tsx|ts|jsx|js)$/;

export function isPageFileName(fileName: string): boolean {
  return PAGE_FILE_RE.test(fileName);
}

function isRouteGroup(seg: string): boolean {
  return /^\(.+\)$/.test(seg) && !/^\(\.+\)/.test(seg);
}

function isInterceptingSegment(seg: string): boolean {
  return /^\(\.+\)/.test(seg);
}

function isParallelSlot(seg: string): boolean {
  return seg.startsWith('@');
}

function isPrivateFolder(seg: string): boolean {
  return seg.startsWith('_');
}

function isCatchAll(seg: string): boolean {
  return /^\[\[?\.\.\..+\]\]?$/.test(seg);
}

function isDynamic(seg: string): boolean {
  return /^\[.+\]$/.test(seg) && !isCatchAll(seg);
}

/** `relPath` is POSIX-style, relative to the app dir, e.g. `blog/[slug]/page.tsx`. */
export function parseAppRoute(relPath: string): RouteResult {
  const parts = relPath.split('/');
  const fileName = parts.pop();
  if (!fileName || !isPageFileName(fileName)) {
    return { ok: false, reason: 'not a page file' };
  }

  const staticSegments: string[] = [];
  let hasDynamic = false;

  for (const seg of parts) {
    if (seg === '') continue;
    if (isParallelSlot(seg)) return { ok: false, reason: `parallel route slot "${seg}" skipped` };
    if (isInterceptingSegment(seg)) return { ok: false, reason: `intercepting route "${seg}" skipped` };
    if (isCatchAll(seg)) return { ok: false, reason: `catch-all route "${seg}" skipped` };
    if (isPrivateFolder(seg)) return { ok: false, reason: `private folder "${seg}" skipped` };
    if (isRouteGroup(seg)) continue; // transparent
    if (isDynamic(seg)) {
      hasDynamic = true;
      continue;
    }
    staticSegments.push(seg);
  }

  const name = staticSegments.length > 0 ? staticSegments[staticSegments.length - 1] : 'home';
  return {
    ok: true,
    kind: hasDynamic ? 'collection' : 'single',
    name,
    segments: [...staticSegments, ...(hasDynamic ? ['[*]'] : [])],
  };
}

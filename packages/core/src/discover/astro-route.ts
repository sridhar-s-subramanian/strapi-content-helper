/**
 * Pure Astro file-based route classifier (T12). Given a `.astro` page path relative
 * to `src/pages`, decide single vs collection. `index` is the home/section root,
 * `[param]` makes a collection, `[...rest]` (catch-all) and `_private` are skipped.
 */
import type { RouteResult } from './next-route.js';

function isCatchAll(seg: string): boolean {
  return /^\[\.\.\..+\]$/.test(seg);
}

function isDynamic(seg: string): boolean {
  return /^\[.+\]$/.test(seg) && !isCatchAll(seg);
}

export function isAstroPageFile(fileName: string): boolean {
  return fileName.endsWith('.astro');
}

export function parseAstroRoute(relPath: string): RouteResult {
  if (!relPath.endsWith('.astro')) return { ok: false, reason: 'not an .astro file' };
  const noExt = relPath.slice(0, -'.astro'.length);
  const parts = noExt.split('/').filter(Boolean);

  const staticSegments: string[] = [];
  let hasDynamic = false;

  for (const seg of parts) {
    if (seg.startsWith('_')) return { ok: false, reason: `private file/folder "${seg}" skipped` };
    if (isCatchAll(seg)) return { ok: false, reason: `catch-all route "${seg}" skipped` };
    if (isDynamic(seg)) {
      hasDynamic = true;
      continue;
    }
    if (seg === 'index') continue; // index doesn't contribute a name
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

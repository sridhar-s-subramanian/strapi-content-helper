/**
 * Astro frontmatter extraction (T12). An `.astro` file optionally opens with a
 * `---` fenced code block containing TypeScript (imports, `interface Props`,
 * `export interface CmsContent`, …). We lift that TS out verbatim so the standard
 * type reader can parse it. Dep-free fence parsing covers the real-world shape.
 */

export function extractFrontmatter(source: string): string | undefined {
  // Allow a leading BOM / whitespace, then a line that is exactly `---`.
  const match = /^﻿?\s*---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return match ? match[1] : undefined;
}

/**
 * Astro discovery (T12). Two sources feed the IR:
 *   1. `src/content.config.ts` content collections (Zod) -> collection types,
 *   2. `.astro` files under `src/pages` whose frontmatter exports `CmsContent`.
 *
 * `.astro` frontmatter is lifted into a virtual `.ts` sibling so relative imports
 * (e.g. shared prop types from `.ts` modules) resolve and the standard type reader runs.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Project } from 'ts-morph';
import { createProject } from '../parse/project.js';
import { extractFrontmatter } from '../parse/astro.js';
import { readAstroCollections } from '../parse/astro-collections.js';
import { readDeclaredType } from '../parse/type-reader.js';
import { matchesAnyGlob } from '../util/glob.js';
import { isAstroPageFile, parseAstroRoute } from './astro-route.js';
import type { DiscoveredModel, DiscoveryResult } from './types.js';

export interface AstroDiscoveryOptions {
  /** Absolute path to the Astro `src` directory. */
  srcDir: string;
  tsConfigFilePath?: string;
  rootDir?: string;
  markerName?: string;
  ignore?: string[];
  project?: Project;
}

function toPosix(p: string): string {
  return p.split(/[\\/]/).join('/');
}

function walkAstro(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkAstro(full));
    else if (isAstroPageFile(entry)) out.push(full);
  }
  return out;
}

function findContentConfig(srcDir: string): string | undefined {
  for (const rel of ['content.config.ts', 'content/config.ts']) {
    const candidate = join(srcDir, rel);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function discoverAstro(opts: AstroDiscoveryOptions): DiscoveryResult {
  const markerName = opts.markerName ?? 'CmsContent';
  const project =
    opts.project ?? createProject({ tsConfigFilePath: opts.tsConfigFilePath, rootDir: opts.rootDir ?? opts.srcDir });

  const models: DiscoveredModel[] = [];
  const warnings: string[] = [];

  // 1. Content collections.
  const configPath = findContentConfig(opts.srcDir);
  if (configPath) {
    const sf =
      project.getSourceFile(toPosix(configPath)) ??
      project.addSourceFileAtPathIfExists(configPath) ??
      project.createSourceFile(configPath, readFileSync(configPath, 'utf8'), { overwrite: true });
    for (const col of readAstroCollections(sf)) {
      models.push({
        kind: 'collection',
        name: col.name,
        source: 'astro',
        filePath: toPosix(configPath),
        segments: [col.name],
        read: col.read,
      });
    }
  }

  // 2. Pages.
  const pagesDir = join(opts.srcDir, 'pages');
  for (const astroPath of walkAstro(pagesDir).sort()) {
    const content = readFileSync(astroPath, 'utf8');
    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) continue;

    // Virtual TS sibling so relative imports resolve from the same directory.
    const virtualPath = `${astroPath}.ts`;
    const sf = project.createSourceFile(virtualPath, frontmatter, { overwrite: true });
    const marker = sf.getInterface(markerName) ?? sf.getTypeAlias(markerName);
    if (!marker || !marker.isExported()) continue;

    const rel = toPosix(relative(pagesDir, astroPath));
    if (matchesAnyGlob(rel, opts.ignore)) {
      warnings.push(`${rel}: ignored by config`);
      continue;
    }

    const route = parseAstroRoute(rel);
    if (!route.ok) {
      warnings.push(`${rel}: opted-in page skipped (${route.reason})`);
      continue;
    }

    models.push({
      kind: route.kind,
      name: route.name,
      source: 'astro',
      filePath: toPosix(astroPath),
      segments: route.segments,
      read: readDeclaredType(marker),
    });
  }

  return { models, warnings };
}

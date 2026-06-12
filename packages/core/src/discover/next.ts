/**
 * Next.js app-router discovery (T05). Finds `page.*` files that export the opt-in
 * marker type (default `CmsContent`), classifies their route, and reads the marker
 * into a field tree. Non-opted pages are silently ignored; opted-in pages on
 * unsupported routes (catch-all, parallel, …) produce a warning.
 */
import { posix, relative } from 'node:path';
import type { InterfaceDeclaration, Project, SourceFile, TypeAliasDeclaration } from 'ts-morph';
import { createProject } from '../parse/project.js';
import { readDeclaredType } from '../parse/type-reader.js';
import { matchesAnyGlob } from '../util/glob.js';
import { isPageFileName, parseAppRoute } from './next-route.js';
import type { DiscoveredModel, DiscoveryResult } from './types.js';

export interface NextDiscoveryOptions {
  /** Absolute path to the Next `app` directory. */
  appDir: string;
  /** Preferred: the frontend tsconfig, so cross-file component types resolve. */
  tsConfigFilePath?: string;
  /** Fallback project root when no tsconfig is given (defaults to appDir). */
  rootDir?: string;
  /** Opt-in marker type name. Default `CmsContent`. */
  markerName?: string;
  /** Glob patterns (POSIX) matched against the app-relative path to exclude. */
  ignore?: string[];
  /** Pre-built project (tests / shared callers). When given, file loading is skipped. */
  project?: Project;
}

function toPosix(p: string): string {
  return p.split(/[\\/]/).join('/');
}

function findMarker(
  sf: SourceFile,
  markerName: string,
): InterfaceDeclaration | TypeAliasDeclaration | undefined {
  const iface = sf.getInterface(markerName);
  if (iface && iface.isExported()) return iface;
  const alias = sf.getTypeAlias(markerName);
  if (alias && alias.isExported()) return alias;
  return undefined;
}

export function discoverNext(opts: NextDiscoveryOptions): DiscoveryResult {
  const markerName = opts.markerName ?? 'CmsContent';
  const appDir = toPosix(opts.appDir);
  const project =
    opts.project ??
    createProject({
      tsConfigFilePath: opts.tsConfigFilePath,
      rootDir: opts.rootDir ?? opts.appDir,
    });

  const models: DiscoveredModel[] = [];
  const warnings: string[] = [];

  const pageFiles = project
    .getSourceFiles()
    .filter((sf) => {
      const fp = toPosix(sf.getFilePath());
      return fp.startsWith(`${appDir}/`) && isPageFileName(posix.basename(fp));
    })
    .sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));

  for (const sf of pageFiles) {
    const fp = toPosix(sf.getFilePath());
    const rel = toPosix(relative(appDir, fp));

    const marker = findMarker(sf, markerName);
    if (!marker) continue; // not opted in — silent

    if (matchesAnyGlob(rel, opts.ignore) || matchesAnyGlob(posix.dirname(rel), opts.ignore)) {
      warnings.push(`${rel}: ignored by config`);
      continue;
    }

    const route = parseAppRoute(rel);
    if (!route.ok) {
      warnings.push(`${rel}: opted-in page skipped (${route.reason})`);
      continue;
    }

    models.push({
      kind: route.kind,
      name: route.name,
      source: 'next',
      filePath: fp,
      segments: route.segments,
      read: readDeclaredType(marker),
    });
  }

  return { models, warnings };
}

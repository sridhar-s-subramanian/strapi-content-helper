/** Shared shape produced by every framework discoverer (Next today, Astro in T12). */
import type { SourceKind } from '../ir/types.js';
import type { ReadResult } from '../parse/field-tree.js';

export interface DiscoveredModel {
  kind: 'single' | 'collection';
  /** Raw route/collection name; the IR builder kebab-cases + singularises it. */
  name: string;
  source: SourceKind;
  /** Absolute path of the file the model was discovered from. */
  filePath: string;
  /** Cleaned route segments, for diagnostics. */
  segments: string[];
  /** The parsed CmsContent / collection field tree. */
  read: ReadResult;
}

export interface DiscoveryResult {
  models: DiscoveredModel[];
  /** Opted-in-but-skipped routes, ignored paths, etc. */
  warnings: string[];
}

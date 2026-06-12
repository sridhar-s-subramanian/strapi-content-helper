// Public API of the core engine.
export const VERSION = '0.1.0';

export * from './ir/types.js';
export * from './emit/constants.js';
export {
  attributeSchema,
  contentTypeSchema,
  componentSchema,
  validateContentType,
  validateComponent,
  type StrapiAttribute,
  type StrapiContentTypeSchema,
  type StrapiComponentSchema,
  type ValidationResult,
} from './emit/validate.js';
export * from './emit/names.js';
export {
  emit,
  emitContentType,
  emitComponent,
  serializeSchema,
  EmitError,
  type EmitResult,
  type EmittedContentType,
  type EmittedComponent,
} from './emit/strapi-v5.js';

// Parsing (T04)
export * from './parse/field-tree.js';
export { parseCmsHints, readCmsTags, readHints } from './parse/cms-hints.js';
export { createProject, type CreateProjectOptions } from './parse/project.js';
export {
  createInMemoryProject,
  readNamedType,
  readDeclaredType,
  readType,
} from './parse/type-reader.js';

// Discovery (T05)
export * from './discover/types.js';
export { parseAppRoute, isPageFileName, type RouteResult } from './discover/next-route.js';
export { discoverNext, type NextDiscoveryOptions } from './discover/next.js';

// Astro parsing + discovery (T11/T12)
export { readAstroCollections, type AstroCollection } from './parse/astro-collections.js';
export { extractFrontmatter } from './parse/astro.js';
export { parseAstroRoute, isAstroPageFile } from './discover/astro-route.js';
export { discoverAstro, type AstroDiscoveryOptions } from './discover/astro.js';

// IR building (T06)
export { buildIr, type BuildIrOptions, type BuildIrResult } from './ir/build.js';

// Merge (T07)
export * from './merge/types.js';
export { mergeSchemas } from './merge/three-way.js';
export {
  readLock,
  writeLock,
  lockPath,
  emitResultToUnits,
  lockToBaseUnits,
  LOCK_VERSION,
  type LockFile,
} from './merge/lock.js';

// Apply + orchestration (T08)
export { readExistingSchemas, type ReadExistingResult } from './apply/read-existing.js';
export { applyChangeSet, type ApplyOptions, type ApplyResult } from './apply/write.js';
export { renderDiff, renderSummary, hasChanges, type RenderOptions } from './apply/render.js';
export { planSync, applyPlan, type SyncConfig, type SyncPlan } from './apply/run.js';

// Utilities
export { matchesGlob, matchesAnyGlob } from './util/glob.js';

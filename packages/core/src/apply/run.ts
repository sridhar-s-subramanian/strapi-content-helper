/**
 * High-level orchestration (T08): discover -> build IR -> emit -> read existing ->
 * 3-way merge, returning a plan. `applyPlan` then writes it. Shared by the CLI (T09)
 * and the Strapi plugin (T14) so the pipeline lives in one place.
 */
import { discoverAstro } from '../discover/astro.js';
import { discoverNext } from '../discover/next.js';
import type { DiscoveredModel } from '../discover/types.js';
import { EmitError, emit, type EmitResult } from '../emit/strapi-v5.js';
import { buildIr } from '../ir/build.js';
import type { Ir } from '../ir/types.js';
import { emitResultToUnits, lockToBaseUnits, readLock } from '../merge/lock.js';
import { mergeSchemas } from '../merge/three-way.js';
import type { ChangeSet, SchemaUnit } from '../merge/types.js';
import { applyChangeSet, type ApplyOptions, type ApplyResult } from './write.js';
import { readExistingSchemas } from './read-existing.js';

export interface SyncConfig {
  framework?: 'next' | 'astro';
  /** Next: absolute path to the `app` directory. */
  appDir?: string;
  /** Astro: absolute path to the `src` directory (used from T12). */
  srcDir?: string;
  tsConfigFilePath?: string;
  rootDir?: string;
  /** Target Strapi project root (where schema files + lockfile live). */
  strapiRoot: string;
  markerName?: string;
  ignore?: string[];
  componentCategory?: string;
  namespaceBySource?: boolean;
  force?: boolean;
  prune?: boolean;
}

export interface SyncPlan {
  ir: Ir;
  emit?: EmitResult;
  changeSet: ChangeSet;
  /** Freshly generated units — become the next lockfile base on apply. */
  lockUnits: SchemaUnit[];
  warnings: string[];
  errors: string[];
}

const EMPTY_CHANGESET: ChangeSet = {
  units: [],
  warnings: [],
  hasConflicts: false,
  hasPendingPrune: false,
};

function discover(config: SyncConfig): { models: DiscoveredModel[]; warnings: string[] } {
  const framework = config.framework ?? (config.appDir ? 'next' : config.srcDir ? 'astro' : undefined);
  if (framework === 'next') {
    if (!config.appDir) throw new Error('next framework requires `appDir`');
    return discoverNext({
      appDir: config.appDir,
      tsConfigFilePath: config.tsConfigFilePath,
      rootDir: config.rootDir,
      markerName: config.markerName,
      ignore: config.ignore,
    });
  }
  if (framework === 'astro') {
    if (!config.srcDir) throw new Error('astro framework requires `srcDir`');
    return discoverAstro({
      srcDir: config.srcDir,
      tsConfigFilePath: config.tsConfigFilePath,
      rootDir: config.rootDir,
      markerName: config.markerName,
      ignore: config.ignore,
    });
  }
  throw new Error(`unsupported or undetected framework: ${framework ?? 'none'} (set config.framework)`);
}

export function planSync(config: SyncConfig): SyncPlan {
  const discovered = discover(config);
  const built = buildIr(discovered.models, {
    componentCategory: config.componentCategory,
    namespaceBySource: config.namespaceBySource,
  });

  const baseWarnings = [...discovered.warnings, ...built.warnings];
  if (built.errors.length > 0) {
    return { ir: built.ir, changeSet: EMPTY_CHANGESET, lockUnits: [], warnings: baseWarnings, errors: built.errors };
  }

  let emitted: EmitResult;
  try {
    emitted = emit(built.ir);
  } catch (err) {
    const message = err instanceof EmitError ? err.message : String(err);
    return { ir: built.ir, changeSet: EMPTY_CHANGESET, lockUnits: [], warnings: baseWarnings, errors: [message] };
  }

  const theirs = emitResultToUnits(emitted);
  const base = lockToBaseUnits(readLock(config.strapiRoot));
  const existing = readExistingSchemas(config.strapiRoot);
  const changeSet = mergeSchemas(base, existing.units, theirs, {
    force: config.force,
    prune: config.prune,
  });

  return {
    ir: built.ir,
    emit: emitted,
    changeSet,
    lockUnits: theirs,
    warnings: [...baseWarnings, ...existing.warnings, ...changeSet.warnings],
    errors: [],
  };
}

export function applyPlan(plan: SyncPlan, strapiRoot: string, opts: ApplyOptions = {}): ApplyResult {
  return applyChangeSet(strapiRoot, plan.changeSet, plan.lockUnits, opts);
}

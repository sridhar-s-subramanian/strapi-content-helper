/**
 * Apply a ChangeSet to a Strapi project (T08): write created/updated schema files,
 * then refresh the lockfile. Honours dry-run (zero writes).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { serializeSchema } from '../emit/strapi-v5.js';
import { writeLock } from '../merge/lock.js';
import type { ChangeSet, SchemaUnit } from '../merge/types.js';

export interface ApplyOptions {
  /** Plan only — do not write any files or the lockfile. */
  dryRun?: boolean;
  /** ISO timestamp recorded in the lockfile (core never reads the clock). */
  generatedAt?: string;
}

export interface ApplyResult {
  written: string[];
  unchanged: number;
  lockUpdated: boolean;
}

/**
 * @param lockUnits the freshly generated units ("theirs") — these become the new
 *        lockfile base, NOT the merged result, so the next run can tell apart our
 *        changes from the user's.
 */
export function applyChangeSet(
  strapiRoot: string,
  changeSet: ChangeSet,
  lockUnits: SchemaUnit[],
  opts: ApplyOptions = {},
): ApplyResult {
  const written: string[] = [];
  let unchanged = 0;

  for (const unit of changeSet.units) {
    if (unit.status === 'unchanged') {
      unchanged++;
      continue;
    }
    written.push(unit.path);
    if (opts.dryRun) continue;
    const absolute = join(strapiRoot, unit.path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, serializeSchema(unit.merged));
  }

  let lockUpdated = false;
  if (!opts.dryRun) {
    writeLock(strapiRoot, lockUnits, opts.generatedAt);
    lockUpdated = true;
  }

  return { written, unchanged, lockUpdated };
}

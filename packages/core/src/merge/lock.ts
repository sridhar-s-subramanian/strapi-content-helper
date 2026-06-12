/**
 * Lockfile I/O (T07). The lockfile records what we last generated (the merge "base")
 * and lives in the Strapi project at `.content-helper/lock.json`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { EmitResult } from '../emit/strapi-v5.js';
import type { SchemaUnit } from './types.js';

export const LOCK_VERSION = 1;

export interface LockFile {
  version: number;
  /** ISO timestamp, supplied by the caller (core never reads the clock). */
  generatedAt?: string;
  units: SchemaUnit[];
}

export function lockPath(strapiRoot: string): string {
  return join(strapiRoot, '.content-helper', 'lock.json');
}

export function readLock(strapiRoot: string): LockFile | null {
  const path = lockPath(strapiRoot);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as LockFile;
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.units)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLock(strapiRoot: string, units: SchemaUnit[], generatedAt?: string): void {
  const path = lockPath(strapiRoot);
  mkdirSync(dirname(path), { recursive: true });
  const lock: LockFile = { version: LOCK_VERSION, ...(generatedAt ? { generatedAt } : {}), units };
  writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`);
}

/** Convert a fresh emit result into lockfile/merge units. */
export function emitResultToUnits(result: EmitResult): SchemaUnit[] {
  return [
    ...result.contentTypes.map((ct) => ({
      uid: ct.uid,
      path: ct.path,
      kind: 'contentType' as const,
      schema: ct.schema as unknown as SchemaUnit['schema'],
    })),
    ...result.components.map((c) => ({
      uid: c.uid,
      path: c.path,
      kind: 'component' as const,
      schema: c.schema as unknown as SchemaUnit['schema'],
    })),
  ];
}

export function lockToBaseUnits(lock: LockFile | null): SchemaUnit[] {
  return lock?.units ?? [];
}

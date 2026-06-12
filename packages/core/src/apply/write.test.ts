import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mergeSchemas } from '../merge/three-way.js';
import { lockPath, readLock } from '../merge/lock.js';
import type { SchemaUnit } from '../merge/types.js';
import { applyChangeSet } from './write.js';
import { readExistingSchemas } from './read-existing.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sch-apply-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function articleUnit(attributes: Record<string, unknown>): SchemaUnit {
  return {
    uid: 'api::article.article',
    path: 'src/api/article/content-types/article/schema.json',
    kind: 'contentType',
    schema: {
      kind: 'collectionType',
      collectionName: 'articles',
      info: { singularName: 'article', pluralName: 'articles', displayName: 'Article' },
      attributes,
    },
  };
}

function heroUnit(): SchemaUnit {
  return {
    uid: 'sections.hero',
    path: 'src/components/sections/hero.json',
    kind: 'component',
    schema: { collectionName: 'components_sections_heros', info: { displayName: 'Hero' }, attributes: { heading: { type: 'string' } } },
  };
}

describe('applyChangeSet', () => {
  it('writes created files to the correct Strapi paths and updates the lockfile', () => {
    const theirs = [articleUnit({ title: { type: 'string' } }), heroUnit()];
    const cs = mergeSchemas([], [], theirs);
    const result = applyChangeSet(root, cs, theirs);

    expect(result.written.sort()).toEqual([
      'src/api/article/content-types/article/schema.json',
      'src/components/sections/hero.json',
    ]);
    expect(existsSync(join(root, 'src/api/article/content-types/article/schema.json'))).toBe(true);
    expect(existsSync(lockPath(root))).toBe(true);
    expect(readLock(root)?.units).toHaveLength(2);
  });

  it('dry-run writes nothing', () => {
    const theirs = [articleUnit({ title: { type: 'string' } })];
    const cs = mergeSchemas([], [], theirs);
    const result = applyChangeSet(root, cs, theirs, { dryRun: true });

    expect(result.written).toHaveLength(1); // reported...
    expect(existsSync(join(root, 'src/api/article/content-types/article/schema.json'))).toBe(false); // ...but not written
    expect(existsSync(lockPath(root))).toBe(false);
  });

  it('round-trips through readExistingSchemas', () => {
    const theirs = [articleUnit({ title: { type: 'string' } }), heroUnit()];
    applyChangeSet(root, mergeSchemas([], [], theirs), theirs);

    const { units } = readExistingSchemas(root);
    expect(units.map((u) => u.uid).sort()).toEqual(['api::article.article', 'sections.hero']);
    const article = units.find((u) => u.uid === 'api::article.article')!;
    expect(article.schema.attributes.title).toEqual({ type: 'string' });
  });

  it('a second apply of the same generation is a no-op (idempotent)', () => {
    const theirs = [articleUnit({ title: { type: 'string' } })];
    applyChangeSet(root, mergeSchemas([], [], theirs), theirs);

    // Re-run: base = lock, ours = on disk, theirs = identical.
    const base = readLock(root)!.units;
    const ours = readExistingSchemas(root).units;
    const cs2 = mergeSchemas(base, ours, theirs);
    expect(cs2.units.every((u) => u.status === 'unchanged')).toBe(true);

    const result2 = applyChangeSet(root, cs2, theirs);
    expect(result2.written).toHaveLength(0);
    expect(result2.unchanged).toBe(1);
  });

  it('preserves a manual edit on re-generation', () => {
    const v1 = [articleUnit({ title: { type: 'string' } })];
    applyChangeSet(root, mergeSchemas([], [], v1), v1);

    // User manually edits the file: title becomes required.
    const ours = readExistingSchemas(root).units;
    (ours[0].schema.attributes as Record<string, unknown>).title = { type: 'string', required: true };

    // Generator adds a new field but still emits plain title.
    const theirs = [articleUnit({ title: { type: 'string' }, body: { type: 'richtext' } })];
    const base = readLock(root)!.units;
    const cs = mergeSchemas(base, ours, theirs);
    applyChangeSet(root, cs, theirs);

    const after = readExistingSchemas(root).units[0].schema.attributes as Record<string, unknown>;
    expect(after.title).toEqual({ type: 'string', required: true }); // manual edit kept
    expect(after.body).toEqual({ type: 'richtext' }); // new field added
  });
});

import { describe, expect, it } from 'vitest';
import { mergeSchemas } from './three-way.js';
import type { SchemaDoc, SchemaUnit } from './types.js';

function unit(attributes: Record<string, unknown>, extra: Partial<SchemaDoc> = {}): SchemaUnit {
  return {
    uid: 'api::article.article',
    path: 'src/api/article/content-types/article/schema.json',
    kind: 'contentType',
    schema: { kind: 'collectionType', collectionName: 'articles', attributes, ...extra },
  };
}

const A = (overrides?: Record<string, unknown>) =>
  unit({ title: { type: 'string' }, ...overrides });

describe('mergeSchemas', () => {
  it('creates a brand new unit', () => {
    const cs = mergeSchemas([], [], [A()]);
    expect(cs.units[0].status).toBe('create');
    expect(cs.units[0].merged.attributes.title).toEqual({ type: 'string' });
  });

  it('is idempotent when base == ours == theirs', () => {
    const u = A();
    const cs = mergeSchemas([u], [u], [u]);
    expect(cs.units[0].status).toBe('unchanged');
    expect(cs.units[0].changes).toEqual([]);
    expect(cs.hasConflicts).toBe(false);
    expect(cs.hasPendingPrune).toBe(false);
  });

  it('adds a new generator attribute additively', () => {
    const base = A();
    const ours = A();
    const theirs = A({ body: { type: 'richtext' } });
    const cs = mergeSchemas([base], [ours], [theirs]);
    expect(cs.units[0].status).toBe('update');
    expect(cs.units[0].changes).toEqual([{ attr: 'body', type: 'add' }]);
    expect(cs.units[0].merged.attributes.body).toEqual({ type: 'richtext' });
  });

  it('applies a generator change the user did not touch', () => {
    const base = A({ count: { type: 'integer' } });
    const ours = A({ count: { type: 'integer' } });
    const theirs = A({ count: { type: 'biginteger' } });
    const cs = mergeSchemas([base], [ours], [theirs]);
    expect(cs.units[0].changes).toEqual([{ attr: 'count', type: 'update' }]);
    expect(cs.units[0].merged.attributes.count).toEqual({ type: 'biginteger' });
  });

  it('preserves a manual edit the generator did not change', () => {
    const base = A({ body: { type: 'text' } });
    const ours = A({ body: { type: 'richtext' } }); // user changed text -> richtext
    const theirs = A({ body: { type: 'text' } }); // generator still emits text
    const cs = mergeSchemas([base], [ours], [theirs]);
    expect(cs.units[0].status).toBe('unchanged');
    expect(cs.units[0].merged.attributes.body).toEqual({ type: 'richtext' });
  });

  it('flags a conflict when both changed, keeping ours unless forced', () => {
    const base = A({ body: { type: 'text' } });
    const ours = A({ body: { type: 'richtext' } });
    const theirs = A({ body: { type: 'string' } });

    const cs = mergeSchemas([base], [ours], [theirs]);
    expect(cs.hasConflicts).toBe(true);
    expect(cs.units[0].changes[0]).toMatchObject({ attr: 'body', type: 'conflict' });
    expect(cs.units[0].merged.attributes.body).toEqual({ type: 'richtext' });

    const forced = mergeSchemas([base], [ours], [theirs], { force: true });
    expect(forced.hasConflicts).toBe(false);
    expect(forced.units[0].merged.attributes.body).toEqual({ type: 'string' });
  });

  it('defers removal without --prune and applies it with --prune', () => {
    const base = A({ legacy: { type: 'string' } });
    const ours = A({ legacy: { type: 'string' } });
    const theirs = A();

    const pending = mergeSchemas([base], [ours], [theirs]);
    expect(pending.hasPendingPrune).toBe(true);
    expect(pending.units[0].merged.attributes.legacy).toBeDefined();
    expect(pending.units[0].changes[0].type).toBe('remove-pending');

    const pruned = mergeSchemas([base], [ours], [theirs], { prune: true });
    expect(pruned.units[0].merged.attributes.legacy).toBeUndefined();
    expect(pruned.units[0].changes[0].type).toBe('remove');
  });

  it('never touches a manually-added attribute the generator never produced', () => {
    const base = A();
    const ours = A({ customNote: { type: 'string' } });
    const theirs = A();
    const cs = mergeSchemas([base], [ours], [theirs], { prune: true });
    expect(cs.units[0].merged.attributes.customNote).toBeDefined();
    expect(cs.units[0].changes).toEqual([]);
  });

  it('detects a rename and refuses to prune it', () => {
    const base = A({ title: { type: 'string' }, heading: undefined });
    // base really just has title; ours/theirs simulate a rename title -> heading
    const baseUnit = unit({ title: { type: 'string' }, oldName: { type: 'string' } });
    const oursUnit = unit({ title: { type: 'string' }, oldName: { type: 'string' } });
    const theirsUnit = unit({ title: { type: 'string' }, newName: { type: 'string' } });
    void base;

    const cs = mergeSchemas([baseUnit], [oursUnit], [theirsUnit], { prune: true });
    const types = cs.units[0].changes.reduce<Record<string, string>>((acc, c) => {
      acc[c.attr] = c.type;
      return acc;
    }, {});
    expect(types.newName).toBe('add');
    expect(types.oldName).toBe('rename');
    // old field kept despite --prune
    expect(cs.units[0].merged.attributes.oldName).toBeDefined();
    expect(cs.warnings.some((w) => w.includes('renamed'))).toBe(true);
  });

  it('warns when a whole type is no longer generated but leaves it in place', () => {
    const u = A();
    const cs = mergeSchemas([u], [u], []);
    expect(cs.units).toHaveLength(0);
    expect(cs.warnings.some((w) => w.includes('no longer generated'))).toBe(true);
  });
});

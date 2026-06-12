/**
 * Pure 3-way merge (T07). Reconciles, per schema file and per attribute:
 *   base   = what we last generated (lockfile)
 *   ours   = what is on disk now (may contain manual edits)
 *   theirs = what we just generated
 *
 * Guarantees idempotency: when base == ours == theirs the result is "unchanged"
 * with no writes. Removals are never destructive unless `prune` is set, and a
 * removed+added pair of identical shape is reported as a probable rename (which is
 * NOT pruned, to avoid losing column data).
 */
import type {
  AttrChange,
  ChangeSet,
  MergeOptions,
  SchemaDoc,
  SchemaUnit,
  UnitResult,
} from './types.js';

/** Recursively key-sorted JSON, so attribute key order never causes a false diff. */
function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
    return out;
  }
  return value;
}

function equal(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

const TOP_LEVEL_KEYS = ['kind', 'collectionName', 'info', 'options', 'pluginOptions'];

function byUid(units: SchemaUnit[]): Map<string, SchemaUnit> {
  return new Map(units.map((u) => [u.uid, u]));
}

type AttrPlan =
  | { kind: 'add'; value: unknown }
  | { kind: 'update'; value: unknown }
  | { kind: 'keep'; value: unknown } // unchanged or preserved manual edit
  | { kind: 'conflict'; value: unknown } // kept ours (or theirs under --force)
  | { kind: 'remove'; value: unknown }; // removed-from-source candidate (ours value)

function planAttribute(
  b: unknown,
  o: unknown,
  t: unknown,
  opts: MergeOptions,
): AttrPlan {
  const hasO = o !== undefined;
  const hasT = t !== undefined;

  if (hasT && !hasO) return { kind: 'add', value: t };

  if (hasT && hasO) {
    if (equal(o, t)) return { kind: 'keep', value: o };
    if (equal(o, b)) return { kind: 'update', value: t }; // user didn't touch -> take generator
    if (equal(t, b)) return { kind: 'keep', value: o }; // generator didn't change -> keep manual edit
    return { kind: 'conflict', value: opts.force ? t : o }; // both changed
  }

  // hasO && !hasT: attribute no longer produced by the source.
  if (equal(o, b)) return { kind: 'remove', value: o }; // we generated it, user left it -> safe to prune
  return { kind: 'keep', value: o }; // manual addition or manually edited -> never auto-touch
}

function mergeUnit(
  base: SchemaUnit | undefined,
  ours: SchemaUnit,
  theirs: SchemaUnit,
  opts: MergeOptions,
  warnings: string[],
): UnitResult {
  const baseAttrs = base?.schema.attributes ?? {};
  const oursAttrs = ours.schema.attributes;
  const theirsAttrs = theirs.schema.attributes;
  const changes: AttrChange[] = [];

  const names = new Set([...Object.keys(theirsAttrs), ...Object.keys(oursAttrs)]);
  const plans = new Map<string, AttrPlan>();
  for (const name of names) {
    plans.set(name, planAttribute(baseAttrs[name], oursAttrs[name], theirsAttrs[name], opts));
  }

  // Rename detection: pair a safe removal with an add of identical shape.
  const adds = [...plans].filter(([, p]) => p.kind === 'add');
  for (const [removedName, removedPlan] of plans) {
    if (removedPlan.kind !== 'remove') continue;
    const match = adds.find(([, addPlan]) => equal(addPlan.value, removedPlan.value));
    if (match) {
      const [addedName] = match;
      plans.set(removedName, { kind: 'keep', value: removedPlan.value });
      changes.push({
        attr: removedName,
        type: 'rename',
        detail: `probably renamed to "${addedName}" — kept to avoid data loss; remove manually if intended`,
      });
      warnings.push(
        `${theirs.uid}: attribute "${removedName}" looks renamed to "${addedName}"; ` +
          `not auto-removed (Strapi treats a rename as drop+add and would lose data)`,
      );
    }
  }

  // Assemble merged attributes: generator order first, then ours-only extras.
  const merged: Record<string, unknown> = {};
  for (const name of Object.keys(theirsAttrs)) {
    const plan = plans.get(name)!;
    if (plan.kind === 'add') changes.push({ attr: name, type: 'add' });
    else if (plan.kind === 'update') changes.push({ attr: name, type: 'update' });
    else if (plan.kind === 'conflict')
      changes.push({
        attr: name,
        type: 'conflict',
        detail: opts.force ? 'overwritten (--force)' : 'kept your edit; use --force to overwrite',
      });
    merged[name] = plan.value;
  }
  for (const name of Object.keys(oursAttrs)) {
    if (name in merged) continue;
    const plan = plans.get(name)!;
    if (plan.kind === 'remove') {
      if (opts.prune) {
        changes.push({ attr: name, type: 'remove' });
        continue; // drop it
      }
      changes.push({
        attr: name,
        type: 'remove-pending',
        detail: 'no longer in source; kept (use --prune to remove)',
      });
    }
    merged[name] = plan.value;
  }

  // Top-level metadata: prefer generator unless the user changed it from base.
  const mergedDoc: SchemaDoc = { ...ours.schema, attributes: merged };
  for (const key of TOP_LEVEL_KEYS) {
    const b = base?.schema[key];
    const o = ours.schema[key];
    const t = theirs.schema[key];
    if (t === undefined) continue;
    if (o === undefined || equal(o, b)) mergedDoc[key] = t;
  }

  const status = equal(mergedDoc, ours.schema) ? 'unchanged' : 'update';
  return { uid: theirs.uid, path: theirs.path, kind: theirs.kind, status, merged: mergedDoc, changes };
}

export function mergeSchemas(
  base: SchemaUnit[],
  ours: SchemaUnit[],
  theirs: SchemaUnit[],
  opts: MergeOptions = {},
): ChangeSet {
  const baseMap = byUid(base);
  const oursMap = byUid(ours);
  const warnings: string[] = [];
  const units: UnitResult[] = [];

  for (const t of theirs) {
    const o = oursMap.get(t.uid);
    if (!o) {
      units.push({ uid: t.uid, path: t.path, kind: t.kind, status: 'create', merged: t.schema, changes: [] });
      continue;
    }
    units.push(mergeUnit(baseMap.get(t.uid), o, t, opts, warnings));
  }

  // Note units that exist on disk but are no longer generated (whole-type removal).
  const theirsUids = new Set(theirs.map((t) => t.uid));
  for (const o of ours) {
    if (theirsUids.has(o.uid)) continue;
    if (baseMap.has(o.uid)) {
      warnings.push(
        `${o.uid}: content type/component is no longer generated from source; left in place ` +
          `(remove ${o.path} manually if intended)`,
      );
    }
  }

  units.sort((a, b) => a.uid.localeCompare(b.uid));
  const hasConflicts = units.some((u) => u.changes.some((c) => c.type === 'conflict' && !opts.force));
  const hasPendingPrune = units.some((u) => u.changes.some((c) => c.type === 'remove-pending'));
  return { units, warnings, hasConflicts, hasPendingPrune };
}

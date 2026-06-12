/**
 * Human-readable rendering of a ChangeSet (T08). Plain text, no colour codes, so it
 * works in CI logs and the admin panel alike.
 */
import type { AttrChangeType, ChangeSet, UnitResult } from '../merge/types.js';

const STATUS_LABEL: Record<UnitResult['status'], string> = {
  create: 'CREATE',
  update: 'UPDATE',
  unchanged: 'ok',
};

const CHANGE_SYMBOL: Record<AttrChangeType, string> = {
  add: '+',
  update: '~',
  remove: '-',
  'remove-pending': '·',
  conflict: '!',
  rename: '»',
};

export interface RenderOptions {
  /** Include units with no changes. */
  verbose?: boolean;
}

export function renderDiff(changeSet: ChangeSet, opts: RenderOptions = {}): string {
  const lines: string[] = [];

  for (const unit of changeSet.units) {
    if (unit.status === 'unchanged' && !opts.verbose) continue;
    lines.push(`${STATUS_LABEL[unit.status]}  ${unit.uid}  (${unit.path})`);
    for (const c of unit.changes) {
      const detail = c.detail ? ` — ${c.detail}` : '';
      lines.push(`    ${CHANGE_SYMBOL[c.type]} ${c.attr}${detail}`);
    }
  }

  for (const w of changeSet.warnings) lines.push(`WARN  ${w}`);

  lines.push('', renderSummary(changeSet));
  return lines.join('\n');
}

export function renderSummary(changeSet: ChangeSet): string {
  const created = changeSet.units.filter((u) => u.status === 'create').length;
  const updated = changeSet.units.filter((u) => u.status === 'update').length;
  const unchanged = changeSet.units.filter((u) => u.status === 'unchanged').length;

  const parts = [`${created} created`, `${updated} updated`, `${unchanged} unchanged`];
  if (changeSet.hasConflicts) parts.push('conflicts (use --force)');
  if (changeSet.hasPendingPrune) parts.push('removals pending (use --prune)');

  const summary = `Summary: ${parts.join(', ')}.`;
  if (created + updated > 0) {
    return `${summary}\nRestart Strapi for changes to take effect (e.g. \`npm run develop\`).`;
  }
  return summary;
}

/** True when the changeset would write at least one file. */
export function hasChanges(changeSet: ChangeSet): boolean {
  return changeSet.units.some((u) => u.status !== 'unchanged');
}

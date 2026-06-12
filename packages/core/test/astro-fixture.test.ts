import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyPlan, hasChanges, planSync, serializeSchema, type SyncConfig } from '../src/index.js';
import { assertGolden } from './golden.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureRoot = join(repoRoot, 'fixtures', 'astro-app');
const goldenDir = join(fixtureRoot, '__goldens__');

let strapiRoot: string;

function config(): SyncConfig {
  return {
    framework: 'astro',
    srcDir: join(fixtureRoot, 'src'),
    tsConfigFilePath: join(fixtureRoot, 'tsconfig.json'),
    rootDir: fixtureRoot,
    strapiRoot,
  };
}

beforeEach(() => {
  strapiRoot = mkdtempSync(join(tmpdir(), 'sch-astro-fixture-'));
});
afterEach(() => {
  rmSync(strapiRoot, { recursive: true, force: true });
});

describe('astro fixture (end-to-end)', () => {
  it('discovers collections + pages and excludes non-CMS routes', () => {
    const plan = planSync(config());
    expect(plan.errors).toEqual([]);
    expect(plan.ir.models.map((m) => m.singularName)).toEqual(['about', 'doc', 'home', 'landing']);
    expect(plan.ir.models.find((m) => m.singularName === 'doc')!.kind).toBe('collection');
    expect(plan.ir.models.find((m) => m.singularName === 'landing')!.kind).toBe('collection');
    expect(plan.ir.models.find((m) => m.singularName === 'home')!.kind).toBe('single');
    expect(plan.warnings.some((w) => w.includes('catch-all'))).toBe(true);
    expect(plan.ir.models.some((m) => m.singularName === 'dashboard')).toBe(false);
  });

  it('matches committed golden schema files', () => {
    const plan = planSync(config());
    for (const ct of plan.emit!.contentTypes) {
      assertGolden(join(goldenDir, ct.path), serializeSchema(ct.schema));
    }
    for (const comp of plan.emit!.components) {
      assertGolden(join(goldenDir, comp.path), serializeSchema(comp.schema));
    }
  });

  it('is idempotent on a second generation', () => {
    const first = planSync(config());
    applyPlan(first, strapiRoot, { generatedAt: '2026-01-01T00:00:00.000Z' });
    const second = planSync(config());
    expect(hasChanges(second.changeSet)).toBe(false);
  });
});

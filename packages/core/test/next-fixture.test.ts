import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyPlan,
  hasChanges,
  planSync,
  readExistingSchemas,
  serializeSchema,
  type SyncConfig,
} from '../src/index.js';
import { assertGolden } from './golden.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureRoot = join(repoRoot, 'fixtures', 'next-app');
const goldenDir = join(fixtureRoot, '__goldens__');

let strapiRoot: string;

function config(): SyncConfig {
  return {
    framework: 'next',
    appDir: join(fixtureRoot, 'app'),
    tsConfigFilePath: join(fixtureRoot, 'tsconfig.json'),
    rootDir: fixtureRoot,
    strapiRoot,
  };
}

beforeEach(() => {
  strapiRoot = mkdtempSync(join(tmpdir(), 'sch-next-fixture-'));
});
afterEach(() => {
  rmSync(strapiRoot, { recursive: true, force: true });
});

describe('next fixture (end-to-end)', () => {
  it('produces the expected models and excludes non-CMS routes', () => {
    const plan = planSync(config());
    expect(plan.errors).toEqual([]);
    expect(plan.ir.models.map((m) => m.singularName)).toEqual(['about', 'blog', 'home']);
    expect(plan.ir.models.find((m) => m.singularName === 'blog')!.kind).toBe('collection');
    expect(plan.ir.models.find((m) => m.singularName === 'home')!.kind).toBe('single');

    // dashboard + products are silently excluded; docs (catch-all) warns.
    expect(plan.warnings.some((w) => w.includes('catch-all'))).toBe(true);
    expect(plan.ir.models.some((m) => ['dashboard', 'product', 'products'].includes(m.singularName))).toBe(
      false,
    );
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

  it('is idempotent: a second generation reports no changes', () => {
    const first = planSync(config());
    applyPlan(first, strapiRoot, { generatedAt: '2026-01-01T00:00:00.000Z' });

    const second = planSync(config());
    expect(second.errors).toEqual([]);
    expect(hasChanges(second.changeSet)).toBe(false);
    expect(second.changeSet.units.every((u) => u.status === 'unchanged')).toBe(true);
  });

  it('preserves a manual schema edit across regeneration', () => {
    const first = planSync(config());
    applyPlan(first, strapiRoot, { generatedAt: '2026-01-01T00:00:00.000Z' });

    // Manually make blog.title required directly in the generated schema file.
    const blogPath = join(strapiRoot, 'src/api/blog/content-types/blog/schema.json');
    const schema = JSON.parse(readFileSync(blogPath, 'utf8'));
    schema.attributes.title.required = true;
    schema.attributes.editorNote = { type: 'text' }; // a purely manual field
    writeFileSync(blogPath, serializeSchema(schema));

    const second = planSync(config());
    applyPlan(second, strapiRoot, { generatedAt: '2026-01-02T00:00:00.000Z' });

    const after = readExistingSchemas(strapiRoot).units.find((u) => u.uid === 'api::blog.blog')!;
    const attrs = after.schema.attributes as Record<string, { required?: boolean; type?: string }>;
    expect(attrs.title.required).toBe(true); // manual edit kept
    expect(attrs.editorNote).toEqual({ type: 'text' }); // manual field kept
  });
});

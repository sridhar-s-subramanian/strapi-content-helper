import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProductionGuardError } from './guard.js';
import createService, { type PluginConfig } from './service.js';
import type { StrapiInstance } from './strapi-types.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const nextFixture = join(repoRoot, 'fixtures', 'next-app');

let strapiRoot: string;

function fakeStrapi(env: string, pluginConfig: PluginConfig): StrapiInstance {
  return {
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    dirs: { app: { root: strapiRoot } },
    config: {
      environment: env,
      get: <T>(path: string, def?: T): T =>
        path === 'plugin::strapi-content-helper' ? (pluginConfig as unknown as T) : (def as T),
    },
    plugin: () => ({ service: () => ({}) as never, config: () => undefined as never }),
  };
}

const cfg: PluginConfig = { framework: 'next', frontendRoot: nextFixture, appDir: 'app' };

beforeEach(() => {
  strapiRoot = mkdtempSync(join(tmpdir(), 'sch-plugin-'));
});
afterEach(() => {
  rmSync(strapiRoot, { recursive: true, force: true });
});

describe('plugin sync service', () => {
  it('preview reports changes without writing', () => {
    const svc = createService({ strapi: fakeStrapi('development', cfg) });
    const preview = svc.preview();
    expect(preview.errors).toEqual([]);
    expect(preview.hasChanges).toBe(true);
    expect(preview.devMode).toBe(true);
    expect(existsSync(join(strapiRoot, 'src'))).toBe(false);
  });

  it('apply writes schema files in development', () => {
    const svc = createService({ strapi: fakeStrapi('development', cfg) });
    const result = svc.apply({});
    expect(result.written.length).toBeGreaterThan(0);
    expect(existsSync(join(strapiRoot, 'src/api/blog/content-types/blog/schema.json'))).toBe(true);
  });

  it('apply is blocked in production but preview still works', () => {
    const svc = createService({ strapi: fakeStrapi('production', cfg) });
    expect(svc.preview().devMode).toBe(false);
    expect(() => svc.apply({})).toThrow(ProductionGuardError);
  });
});

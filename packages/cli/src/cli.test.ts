import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from './cli.js';

let dir: string;
let configPath: string;
let strapiRoot: string;

function writeFrontend(pages: Record<string, string>): void {
  for (const [rel, content] of Object.entries(pages)) {
    const full = join(dir, 'frontend', rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
}

async function runCli(...args: string[]): Promise<number> {
  process.exitCode = 0;
  await run(['node', 'schc', ...args]);
  const code = Number(process.exitCode ?? 0);
  process.exitCode = 0;
  return code;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sch-cli-'));
  strapiRoot = join(dir, 'strapi');
  mkdirSync(strapiRoot, { recursive: true });
  configPath = join(dir, 'content-helper.config.json');
  writeFileSync(
    configPath,
    JSON.stringify({ framework: 'next', frontendRoot: 'frontend', appDir: 'app', strapiRoot: 'strapi' }),
  );
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe('cli', () => {
  it('generate writes schema files and is idempotent; check reflects drift', async () => {
    writeFrontend({
      'app/about/page.tsx': `export interface CmsContent { heading: string; }\nexport default function P() { return null; }`,
      'app/blog/[slug]/page.tsx': `export interface CmsContent { title: string; }\nexport default function P() { return null; }`,
    });

    expect(await runCli('generate', '--config', configPath)).toBe(0);
    expect(existsSync(join(strapiRoot, 'src/api/about/content-types/about/schema.json'))).toBe(true);
    expect(existsSync(join(strapiRoot, 'src/api/blog/content-types/blog/schema.json'))).toBe(true);
    expect(existsSync(join(strapiRoot, '.content-helper/lock.json'))).toBe(true);

    // up to date now
    expect(await runCli('check', '--config', configPath)).toBe(0);

    // introduce drift
    writeFrontend({
      'app/about/page.tsx': `export interface CmsContent { heading: string; subtitle?: string; }\nexport default function P() { return null; }`,
    });
    expect(await runCli('check', '--config', configPath)).toBe(1);

    // generate again, then check clean
    expect(await runCli('generate', '--config', configPath)).toBe(0);
    expect(await runCli('check', '--config', configPath)).toBe(0);
  });

  it('dry-run writes nothing', async () => {
    writeFrontend({
      'app/about/page.tsx': `export interface CmsContent { heading: string; }\nexport default function P() { return null; }`,
    });
    expect(await runCli('generate', '--config', configPath, '--dry-run')).toBe(0);
    expect(existsSync(join(strapiRoot, 'src/api/about/content-types/about/schema.json'))).toBe(false);
  });

  it('init scaffolds a config and refuses to overwrite', async () => {
    const target = join(dir, 'fresh.config.json');
    expect(await runCli('init', '--config', target)).toBe(0);
    expect(existsSync(target)).toBe(true);
    expect(await runCli('init', '--config', target)).toBe(1);
  });
});

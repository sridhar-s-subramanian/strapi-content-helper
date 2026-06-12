/**
 * Config discovery + resolution for the CLI. A `content-helper.config.{json,js,mjs,cjs,ts}`
 * file declares where the frontend and Strapi projects live; this module loads it and
 * resolves every path to an absolute path for the core engine.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SyncConfig } from '@strapi-content-helper/core';

export interface FileConfig {
  framework?: 'next' | 'astro';
  /** Base dir for appDir/srcDir/tsconfig. Defaults to the config file's directory. */
  frontendRoot?: string;
  appDir?: string;
  srcDir?: string;
  tsConfigFilePath?: string;
  /** Required: path to the target Strapi project root. */
  strapiRoot: string;
  markerName?: string;
  ignore?: string[];
  componentCategory?: string;
  namespaceBySource?: boolean;
}

const CONFIG_FILENAMES = [
  'content-helper.config.json',
  'content-helper.config.js',
  'content-helper.config.mjs',
  'content-helper.config.cjs',
  'content-helper.config.ts',
];

export interface LoadedConfig {
  config: SyncConfig;
  /** Path the config was loaded from. */
  source: string;
}

export function findConfigFile(cwd: string = process.cwd()): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function loadFileConfig(path: string): Promise<FileConfig> {
  if (path.endsWith('.json')) {
    return JSON.parse(await readFile(path, 'utf8')) as FileConfig;
  }
  const mod = (await import(pathToFileURL(path).href)) as { default?: FileConfig } & FileConfig;
  return (mod.default ?? mod) as FileConfig;
}

function abs(base: string, p: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

function autodetectAppDir(frontendRoot: string): string | undefined {
  for (const rel of ['app', 'src/app']) {
    if (existsSync(join(frontendRoot, rel))) return join(frontendRoot, rel);
  }
  return undefined;
}

export function resolveConfig(file: FileConfig, configPath: string): SyncConfig {
  const configDir = dirname(configPath);
  if (!file.strapiRoot) {
    throw new Error('config error: "strapiRoot" is required');
  }
  const frontendRoot = file.frontendRoot ? abs(configDir, file.frontendRoot) : configDir;
  const appDir = file.appDir ? abs(frontendRoot, file.appDir) : autodetectAppDir(frontendRoot);
  const tsConfigFilePath = file.tsConfigFilePath
    ? abs(frontendRoot, file.tsConfigFilePath)
    : existsSync(join(frontendRoot, 'tsconfig.json'))
      ? join(frontendRoot, 'tsconfig.json')
      : undefined;

  const framework = file.framework ?? (appDir ? 'next' : undefined);

  return {
    framework,
    appDir,
    srcDir: file.srcDir ? abs(frontendRoot, file.srcDir) : undefined,
    tsConfigFilePath,
    rootDir: frontendRoot,
    strapiRoot: abs(configDir, file.strapiRoot),
    markerName: file.markerName,
    ignore: file.ignore,
    componentCategory: file.componentCategory,
    namespaceBySource: file.namespaceBySource,
  };
}

export async function loadConfig(explicitPath?: string): Promise<LoadedConfig> {
  const path = explicitPath ? resolve(explicitPath) : findConfigFile();
  if (!path) {
    throw new Error(
      'No config found. Create content-helper.config.json (run `strapi-content-helper init`) or pass --config.',
    );
  }
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const file = await loadFileConfig(path);
  return { config: resolveConfig(file, path), source: path };
}

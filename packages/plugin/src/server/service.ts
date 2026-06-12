/**
 * Plugin service: resolves the plugin config into a core SyncConfig and runs the
 * pipeline. `preview` is always allowed; `apply` is dev-only (guarded).
 */
import { isAbsolute, resolve } from 'node:path';
import {
  applyPlan,
  hasChanges,
  planSync,
  renderDiff,
  type ChangeSet,
  type SyncConfig,
} from '@swamp-crocodile/content-helper-core';
import { assertDevelopment, isDevelopment } from './guard.js';
import type { StrapiInstance } from './strapi-types.js';

export interface PluginConfig {
  framework?: 'next' | 'astro';
  /** Frontend project root; relative paths below resolve against it. */
  frontendRoot?: string;
  appDir?: string;
  srcDir?: string;
  tsConfigFilePath?: string;
  markerName?: string;
  ignore?: string[];
  componentCategory?: string;
  namespaceBySource?: boolean;
}

export interface PreviewResult {
  diff: string;
  changeSet: ChangeSet;
  warnings: string[];
  errors: string[];
  hasChanges: boolean;
  devMode: boolean;
}

export interface ApplyResultDto extends PreviewResult {
  written: string[];
}

function abs(base: string, p: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

function resolveSyncConfig(strapi: StrapiInstance): SyncConfig {
  const cfg = strapi.config.get<PluginConfig>('plugin::content-helper', {});
  const strapiRoot = strapi.dirs.app.root;
  const frontendRoot = cfg.frontendRoot ? abs(strapiRoot, cfg.frontendRoot) : strapiRoot;

  return {
    framework: cfg.framework,
    appDir: cfg.appDir ? abs(frontendRoot, cfg.appDir) : undefined,
    srcDir: cfg.srcDir ? abs(frontendRoot, cfg.srcDir) : undefined,
    tsConfigFilePath: cfg.tsConfigFilePath ? abs(frontendRoot, cfg.tsConfigFilePath) : undefined,
    rootDir: frontendRoot,
    strapiRoot,
    markerName: cfg.markerName,
    ignore: cfg.ignore,
    componentCategory: cfg.componentCategory,
    namespaceBySource: cfg.namespaceBySource,
  };
}

export default ({ strapi }: { strapi: StrapiInstance }) => ({
  preview(): PreviewResult {
    const config = resolveSyncConfig(strapi);
    const plan = planSync(config);
    return {
      diff: renderDiff(plan.changeSet),
      changeSet: plan.changeSet,
      warnings: plan.warnings,
      errors: plan.errors,
      hasChanges: hasChanges(plan.changeSet),
      devMode: isDevelopment(strapi),
    };
  },

  apply(opts: { force?: boolean; prune?: boolean } = {}): ApplyResultDto {
    assertDevelopment(strapi);
    const config = { ...resolveSyncConfig(strapi), force: opts.force, prune: opts.prune };
    const plan = planSync(config);

    if (plan.errors.length > 0) {
      return {
        diff: renderDiff(plan.changeSet),
        changeSet: plan.changeSet,
        warnings: plan.warnings,
        errors: plan.errors,
        hasChanges: false,
        devMode: true,
        written: [],
      };
    }

    const result = applyPlan(plan, config.strapiRoot, { generatedAt: new Date().toISOString() });
    strapi.log.info(`[content-helper] wrote ${result.written.length} schema file(s); restart Strapi to apply.`);
    return {
      diff: renderDiff(plan.changeSet),
      changeSet: plan.changeSet,
      warnings: plan.warnings,
      errors: plan.errors,
      hasChanges: hasChanges(plan.changeSet),
      devMode: true,
      written: result.written,
    };
  },
});

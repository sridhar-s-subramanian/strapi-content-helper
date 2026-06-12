/**
 * Commander wiring for the `strapi-content-helper` CLI (T09).
 * Commands: generate (sync), check (CI drift gate), init (scaffold config).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyPlan, hasChanges, planSync, renderDiff, VERSION } from '@strapi-content-helper/core';
import { Command } from 'commander';
import { loadConfig } from './config.js';

interface GenerateFlags {
  config?: string;
  dryRun?: boolean;
  force?: boolean;
  prune?: boolean;
  verbose?: boolean;
}

function reportErrors(errors: string[]): void {
  console.error('\nErrors:');
  for (const e of errors) console.error(`  - ${e}`);
}

async function runGenerate(flags: GenerateFlags): Promise<number> {
  const { config, source } = await loadConfig(flags.config);
  console.log(`Using config: ${source}`);

  const plan = planSync({ ...config, force: flags.force, prune: flags.prune });

  if (plan.errors.length > 0) {
    reportErrors(plan.errors);
    return 1;
  }

  console.log(renderDiff(plan.changeSet, { verbose: flags.verbose }));

  if (plan.changeSet.hasConflicts && !flags.force) {
    console.error('\nResolve conflicts or re-run with --force.');
    return 1;
  }

  if (flags.dryRun) {
    console.log('\n(dry run — no files written)');
    return 0;
  }

  if (!hasChanges(plan.changeSet)) return 0;

  const result = applyPlan(plan, config.strapiRoot, { generatedAt: new Date().toISOString() });
  console.log(`\nWrote ${result.written.length} file(s).`);
  return 0;
}

async function runCheck(flags: { config?: string }): Promise<number> {
  const { config } = await loadConfig(flags.config);
  const plan = planSync(config);
  if (plan.errors.length > 0) {
    reportErrors(plan.errors);
    return 1;
  }
  if (hasChanges(plan.changeSet)) {
    console.log(renderDiff(plan.changeSet));
    console.error('\nContent model is out of date. Run `strapi-content-helper generate`.');
    return 1;
  }
  console.log('Content model is up to date.');
  return 0;
}

const DEFAULT_CONFIG = {
  framework: 'next',
  frontendRoot: '.',
  strapiRoot: '../strapi',
  markerName: 'CmsContent',
  componentCategory: 'sections',
  ignore: [] as string[],
};

function runInit(flags: { config?: string }): number {
  const path = flags.config ?? join(process.cwd(), 'content-helper.config.json');
  if (existsSync(path)) {
    console.error(`Refusing to overwrite existing config: ${path}`);
    return 1;
  }
  writeFileSync(path, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  console.log(`Created ${path}. Edit "strapiRoot" (and "appDir" if not auto-detected) before running generate.`);
  return 0;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('strapi-content-helper')
    .description('Generate and sync Strapi v5 content models from Next.js / Astro code')
    .version(VERSION);

  program
    .command('generate')
    .description('Generate/update Strapi schema files from the frontend code')
    .option('-c, --config <path>', 'path to config file')
    .option('--dry-run', 'show the diff without writing files')
    .option('--force', 'overwrite attributes that were manually edited')
    .option('--prune', 'remove attributes the source no longer produces')
    .option('--verbose', 'include unchanged content types in the diff')
    .action(async (flags: GenerateFlags) => {
      process.exitCode = await runGenerate(flags);
    });

  program
    .command('check')
    .description('Exit non-zero if the Strapi content model is out of date (CI)')
    .option('-c, --config <path>', 'path to config file')
    .action(async (flags: { config?: string }) => {
      process.exitCode = await runCheck(flags);
    });

  program
    .command('init')
    .description('Scaffold a content-helper.config.json')
    .option('-c, --config <path>', 'path to write the config file')
    .action((flags: { config?: string }) => {
      process.exitCode = runInit(flags);
    });

  return program;
}

export async function run(argv: string[]): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

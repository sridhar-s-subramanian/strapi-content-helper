/**
 * ts-morph Project construction for parsing a real frontend repo. Prefer the repo's
 * own tsconfig (resolves the whole program incl. cross-file component types); fall
 * back to globbing the source root when no tsconfig is given.
 */
import { Project, type ProjectOptions } from 'ts-morph';

export interface CreateProjectOptions {
  /** Path to the frontend tsconfig.json (preferred — resolves all imports). */
  tsConfigFilePath?: string;
  /** When no tsconfig is given, glob `.ts/.tsx/.js/.jsx` under this root. */
  rootDir?: string;
}

export function createProject(opts: CreateProjectOptions): Project {
  if (opts.tsConfigFilePath) {
    const projectOpts: ProjectOptions = {
      tsConfigFilePath: opts.tsConfigFilePath,
      skipAddingFilesFromTsConfig: false,
    };
    return new Project(projectOpts);
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      strict: true,
      allowJs: true,
      jsx: 4, // ts.JsxEmit.ReactJSX
      moduleResolution: 99, // ts.ModuleResolutionKind.Bundler
    },
  });
  if (opts.rootDir) {
    project.addSourceFilesAtPaths([
      `${opts.rootDir}/**/*.{ts,tsx,js,jsx}`,
      `!${opts.rootDir}/**/node_modules/**`,
      `!${opts.rootDir}/**/dist/**`,
      `!${opts.rootDir}/**/.next/**`,
    ]);
  }
  return project;
}

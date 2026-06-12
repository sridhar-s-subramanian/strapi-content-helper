/**
 * Dev-mode guard. Generation rewrites files under the Strapi project's `src/` and
 * requires a restart — neither is safe (or possible) in a typical production
 * deployment (read-only image, no self-restart). So apply is dev-only.
 */
import type { StrapiInstance } from './strapi-types.js';

export class ProductionGuardError extends Error {
  constructor() {
    super(
      'content-helper sync is disabled in production. Run the CLI in CI, commit the schema files, and deploy.',
    );
    this.name = 'ProductionGuardError';
  }
}

export function isDevelopment(strapi: StrapiInstance): boolean {
  const env = strapi.config.environment ?? process.env.NODE_ENV;
  return env !== 'production';
}

export function assertDevelopment(strapi: StrapiInstance): void {
  if (!isDevelopment(strapi)) throw new ProductionGuardError();
}

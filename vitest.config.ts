import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Run cross-package tests against core source, not its built dist.
      '@strapi-content-helper/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    include: ['packages/*/src/**/*.{test,spec}.ts', 'packages/*/test/**/*.{test,spec}.ts'],
    // E2E tests are opt-in (they boot a real Strapi app); run via `pnpm test:e2e`.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.e2e.test.ts'],
  },
});

/**
 * Strapi v5 plugin server entry. Registered via `strapi-server.js` (see package
 * `strapi` export). Exposes the sync service + admin controller/routes.
 */
import controller from './controller.js';
import routes from './routes.js';
import service from './service.js';
import type { StrapiInstance } from './strapi-types.js';

export default {
  register() {
    // No-op: schema generation is on-demand (admin button / CLI), not on boot.
  },
  bootstrap({ strapi }: { strapi: StrapiInstance }) {
    strapi.log.info('[content-helper] plugin loaded (sync available in development).');
  },
  controllers: { controller },
  services: { sync: service },
  routes: {
    admin: {
      type: 'admin',
      routes,
    },
  },
  config: {
    default: {
      framework: undefined,
      markerName: 'CmsContent',
      componentCategory: 'sections',
      ignore: [] as string[],
      namespaceBySource: false,
    },
    validator() {
      // Paths are validated lazily by the core engine when sync runs.
    },
  },
};

export { ProductionGuardError, isDevelopment, assertDevelopment } from './guard.js';
export type { PluginConfig, PreviewResult, ApplyResultDto } from './service.js';

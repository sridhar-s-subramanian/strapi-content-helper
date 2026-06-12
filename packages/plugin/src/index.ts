/**
 * Strapi v5 plugin: generate/sync content models from frontend code (dev-mode).
 * The server entry lives in `./server`; the admin UI in `./admin` (bundled by the
 * Strapi plugin toolchain, not by this package's tsc build).
 */
export const PLUGIN_ID = 'strapi-content-helper';
export { default as server } from './server/index.js';
export type { PluginConfig, PreviewResult, ApplyResultDto } from './server/service.js';

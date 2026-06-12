/**
 * Admin controller. Delegates to the service; maps the production guard to HTTP 403.
 */
import { ProductionGuardError } from './guard.js';
import type { ApplyResultDto, PreviewResult } from './service.js';
import type { StrapiInstance } from './strapi-types.js';

export interface Ctx {
  request: { body?: { force?: boolean; prune?: boolean } };
  body?: unknown;
  status?: number;
}

interface PluginService {
  preview(): PreviewResult;
  apply(opts: { force?: boolean; prune?: boolean }): ApplyResultDto;
}

function service(strapi: StrapiInstance): PluginService {
  return strapi.plugin('strapi-content-helper').service<PluginService>('sync');
}

export default ({ strapi }: { strapi: StrapiInstance }) => ({
  preview(ctx: Ctx) {
    ctx.body = service(strapi).preview();
  },

  apply(ctx: Ctx) {
    try {
      ctx.body = service(strapi).apply(ctx.request.body ?? {});
    } catch (err) {
      if (err instanceof ProductionGuardError) {
        ctx.status = 403;
        ctx.body = { error: err.message };
        return;
      }
      throw err;
    }
  },
});

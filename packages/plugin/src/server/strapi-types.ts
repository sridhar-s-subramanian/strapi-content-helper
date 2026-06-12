/**
 * Minimal structural typing for the bits of the Strapi v5 instance we use. Avoids a
 * hard dependency on the large `@strapi/strapi` type packages while keeping the
 * server code type-checked.
 */
export interface StrapiLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface StrapiInstance {
  log: StrapiLogger;
  dirs: { app: { root: string } };
  config: {
    get<T = unknown>(path: string, defaultValue?: T): T;
    environment?: string;
  };
  plugin(name: string): { service<T = unknown>(name: string): T; config<T = unknown>(key: string): T };
}

export interface PluginContext {
  strapi: StrapiInstance;
}

/**
 * Strapi v5 naming rules and reserved words. Centralised so the emitter (T03),
 * validator (T02), and IR builder (T06) all agree on what is legal.
 */

/**
 * Attribute keys Strapi manages itself — a user-defined attribute must never use
 * one of these names or the content-type fails to load / silently misbehaves.
 */
export const RESERVED_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
  '__component',
  '__contentType',
  'strapi',
]);

/** kebab-case singular/plural names: lowercase, hyphen-separated, must start with a letter. */
export const KEBAB_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** camelCase-ish attribute key: starts with a letter/underscore, no spaces or dots. */
export const ATTRIBUTE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Enumeration value: Strapi requires values usable as identifiers (no leading digit, no spaces). */
export const ENUM_VALUE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Component UID: `<category>.<name>`, both kebab-case. */
export const COMPONENT_UID_RE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** Content-type UID: `api::<singular>.<singular>` (also accepts plugin::/admin:: targets). */
export const CONTENT_TYPE_UID_RE = /^(api|plugin|admin)::[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

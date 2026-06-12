/**
 * Intermediate Representation (IR) — the contract between the framework parsers
 * (Next/Astro) and the Strapi v5 emitter. Parsers produce an `Ir`; the emitter and
 * merge engine consume it. Changing these shapes is a breaking change across tasks.
 */

/** Which frontend the model/component originated from (used for collision namespacing). */
export type SourceKind = 'next' | 'astro';

/** Strapi scalar attribute types we emit directly. */
export type ScalarType =
  | 'string'
  | 'text'
  | 'richtext'
  | 'email'
  | 'password'
  | 'uid'
  | 'integer'
  | 'biginteger'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'json';

export type RelationKind = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';

export type MediaKind = 'images' | 'files' | 'videos' | 'audios';

interface FieldBase {
  /** Attribute key as it appears in Strapi (camelCase, mirrors the source prop name). */
  name: string;
  /** Whether the source prop was non-optional. */
  required: boolean;
}

export interface ScalarField extends FieldBase {
  type: ScalarType;
}

export interface EnumField extends FieldBase {
  type: 'enumeration';
  values: string[];
}

export interface MediaField extends FieldBase {
  type: 'media';
  multiple: boolean;
  allowedTypes?: MediaKind[];
}

export interface ComponentField extends FieldBase {
  type: 'component';
  /** Component UID, e.g. `sections.hero`. */
  component: string;
  repeatable: boolean;
}

export interface DynamicZoneField extends FieldBase {
  type: 'dynamiczone';
  /** Component UIDs that may appear in the zone, e.g. `["sections.hero", "sections.cta"]`. */
  components: string[];
}

export interface RelationField extends FieldBase {
  type: 'relation';
  relation: RelationKind;
  /** Target content-type UID, e.g. `api::author.author`. */
  target: string;
}

export type Field =
  | ScalarField
  | EnumField
  | MediaField
  | ComponentField
  | DynamicZoneField
  | RelationField;

/** A reusable Strapi component (lives at `src/components/<category>/<name>.json`). */
export interface ComponentDef {
  /** kebab-case category folder, e.g. `sections`. */
  category: string;
  /** kebab-case component name, unique within its category, e.g. `hero`. */
  name: string;
  displayName: string;
  fields: Field[];
  source?: SourceKind;
}

/** A Strapi single type or collection type. */
export interface ContentModel {
  kind: 'single' | 'collection';
  /** kebab-case singular, e.g. `blog-post`. Drives the api folder + UID. */
  singularName: string;
  /** kebab-case plural, e.g. `blog-posts`. */
  pluralName: string;
  displayName: string;
  fields: Field[];
  draftAndPublish: boolean;
  source?: SourceKind;
}

/** The full content model extracted from a source tree. */
export interface Ir {
  models: ContentModel[];
  components: ComponentDef[];
}

/** UID of a content model as referenced by relations: `api::<singular>.<singular>`. */
export function contentTypeUid(singularName: string): string {
  return `api::${singularName}.${singularName}`;
}

/** UID of a component: `<category>.<name>`. */
export function componentUid(category: string, name: string): string {
  return `${category}.${name}`;
}

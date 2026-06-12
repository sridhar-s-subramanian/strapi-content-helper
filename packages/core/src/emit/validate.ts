/**
 * Zod schemas describing valid Strapi v5 `schema.json` files, plus the constraint
 * checks from FR3. Nothing the emitter produces may reach disk without passing these.
 *
 * These types double as the on-disk shape the merge engine (T07) reads back.
 */
import { z } from 'zod';
import {
  ATTRIBUTE_NAME_RE,
  COMPONENT_UID_RE,
  CONTENT_TYPE_UID_RE,
  ENUM_VALUE_RE,
  KEBAB_NAME_RE,
  RESERVED_ATTRIBUTE_NAMES,
} from './constants.js';

const scalarType = z.enum([
  'string',
  'text',
  'richtext',
  'email',
  'password',
  'uid',
  'integer',
  'biginteger',
  'float',
  'decimal',
  'boolean',
  'date',
  'time',
  'datetime',
  'json',
]);

const commonAttrFlags = {
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  private: z.boolean().optional(),
  configurable: z.boolean().optional(),
};

const scalarAttribute = z
  .object({ type: scalarType, ...commonAttrFlags })
  .passthrough();

const enumAttribute = z
  .object({
    type: z.literal('enumeration'),
    enum: z
      .array(z.string().regex(ENUM_VALUE_RE, 'invalid enumeration value'))
      .min(1),
    ...commonAttrFlags,
  })
  .passthrough();

const mediaAttribute = z
  .object({
    type: z.literal('media'),
    multiple: z.boolean(),
    allowedTypes: z.array(z.enum(['images', 'files', 'videos', 'audios'])).optional(),
    ...commonAttrFlags,
  })
  .passthrough();

const componentAttribute = z
  .object({
    type: z.literal('component'),
    component: z.string().regex(COMPONENT_UID_RE, 'invalid component UID'),
    repeatable: z.boolean(),
    ...commonAttrFlags,
  })
  .passthrough();

const dynamicZoneAttribute = z
  .object({
    type: z.literal('dynamiczone'),
    components: z.array(z.string().regex(COMPONENT_UID_RE, 'invalid component UID')).min(1),
    ...commonAttrFlags,
  })
  .passthrough();

const relationAttribute = z
  .object({
    type: z.literal('relation'),
    relation: z.enum(['oneToOne', 'oneToMany', 'manyToOne', 'manyToMany']),
    target: z.string().regex(CONTENT_TYPE_UID_RE, 'invalid relation target UID'),
    inversedBy: z.string().optional(),
    mappedBy: z.string().optional(),
    ...commonAttrFlags,
  })
  .passthrough();

export const attributeSchema = z.union([
  scalarAttribute,
  enumAttribute,
  mediaAttribute,
  componentAttribute,
  dynamicZoneAttribute,
  relationAttribute,
]);

/** Attribute map with reserved-name + key-format enforcement. */
const attributesRecord = z
  .record(z.string(), attributeSchema)
  .superRefine((attrs, ctx) => {
    for (const key of Object.keys(attrs)) {
      if (!ATTRIBUTE_NAME_RE.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `attribute name "${key}" is not a valid identifier`,
          path: [key],
        });
      }
      if (RESERVED_ATTRIBUTE_NAMES.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `attribute name "${key}" is reserved by Strapi`,
          path: [key],
        });
      }
    }
  });

export const contentTypeSchema = z
  .object({
    kind: z.enum(['collectionType', 'singleType']),
    collectionName: z.string().min(1),
    info: z
      .object({
        singularName: z.string().regex(KEBAB_NAME_RE, 'singularName must be kebab-case'),
        pluralName: z.string().regex(KEBAB_NAME_RE, 'pluralName must be kebab-case'),
        displayName: z.string().min(1),
        description: z.string().optional(),
      })
      .passthrough(),
    options: z.object({ draftAndPublish: z.boolean().optional() }).passthrough().optional(),
    pluginOptions: z.record(z.string(), z.unknown()).optional(),
    attributes: attributesRecord,
  })
  .passthrough()
  .superRefine((schema, ctx) => {
    if (schema.info.singularName === schema.info.pluralName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'singularName and pluralName must differ',
        path: ['info', 'pluralName'],
      });
    }
  });

export const componentSchema = z
  .object({
    collectionName: z.string().min(1),
    info: z
      .object({
        displayName: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
      })
      .passthrough(),
    options: z.record(z.string(), z.unknown()).optional(),
    attributes: attributesRecord,
  })
  .passthrough();

export type StrapiAttribute = z.infer<typeof attributeSchema>;
export type StrapiContentTypeSchema = z.infer<typeof contentTypeSchema>;
export type StrapiComponentSchema = z.infer<typeof componentSchema>;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  /** Human-readable `path: message` lines, empty when success. */
  errors: string[];
}

function toResult<T>(parsed: z.SafeParseReturnType<unknown, T>): ValidationResult<T> {
  if (parsed.success) {
    return { success: true, data: parsed.data, errors: [] };
  }
  const errors = parsed.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { success: false, errors };
}

export function validateContentType(input: unknown): ValidationResult<StrapiContentTypeSchema> {
  return toResult(contentTypeSchema.safeParse(input));
}

export function validateComponent(input: unknown): ValidationResult<StrapiComponentSchema> {
  return toResult(componentSchema.safeParse(input));
}

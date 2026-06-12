/**
 * IR -> Strapi v5 `schema.json` objects. Output is deterministic (stable key order)
 * and every emitted schema is validated before it is returned (FR3).
 */
import type {
  ComponentDef,
  ContentModel,
  Field,
  Ir,
} from '../ir/types.js';
import { componentUid } from '../ir/types.js';
import {
  componentCollectionName,
  componentSchemaPath,
  contentTypeCollectionName,
  contentTypeSchemaPath,
} from './names.js';
import {
  validateComponent,
  validateContentType,
  type StrapiAttribute,
  type StrapiComponentSchema,
  type StrapiContentTypeSchema,
} from './validate.js';

export class EmitError extends Error {
  constructor(
    message: string,
    readonly errors: string[],
  ) {
    super(`${message}\n  - ${errors.join('\n  - ')}`);
    this.name = 'EmitError';
  }
}

export interface EmittedContentType {
  uid: string;
  singularName: string;
  path: string;
  schema: StrapiContentTypeSchema;
}

export interface EmittedComponent {
  uid: string;
  category: string;
  name: string;
  path: string;
  schema: StrapiComponentSchema;
}

export interface EmitResult {
  contentTypes: EmittedContentType[];
  components: EmittedComponent[];
}

/** Build a single attribute object with a stable key order per type. */
function emitAttribute(field: Field): StrapiAttribute {
  switch (field.type) {
    case 'enumeration': {
      const attr: Record<string, unknown> = { type: 'enumeration', enum: field.values };
      if (field.required) attr.required = true;
      return attr as StrapiAttribute;
    }
    case 'media': {
      const attr: Record<string, unknown> = { type: 'media', multiple: field.multiple };
      if (field.allowedTypes) attr.allowedTypes = field.allowedTypes;
      if (field.required) attr.required = true;
      return attr as StrapiAttribute;
    }
    case 'component': {
      const attr: Record<string, unknown> = {
        type: 'component',
        repeatable: field.repeatable,
        component: field.component,
      };
      if (field.required) attr.required = true;
      return attr as StrapiAttribute;
    }
    case 'dynamiczone': {
      const attr: Record<string, unknown> = { type: 'dynamiczone', components: field.components };
      if (field.required) attr.required = true;
      return attr as StrapiAttribute;
    }
    case 'relation': {
      const attr: Record<string, unknown> = {
        type: 'relation',
        relation: field.relation,
        target: field.target,
      };
      if (field.required) attr.required = true;
      return attr as StrapiAttribute;
    }
    default: {
      // scalar types
      const attr: Record<string, unknown> = { type: field.type };
      if (field.required) attr.required = true;
      return attr as StrapiAttribute;
    }
  }
}

/** Build the ordered attributes record, preserving IR field order. */
function emitAttributes(fields: Field[]): Record<string, StrapiAttribute> {
  const attributes: Record<string, StrapiAttribute> = {};
  for (const field of fields) {
    attributes[field.name] = emitAttribute(field);
  }
  return attributes;
}

export function emitContentType(model: ContentModel): EmittedContentType {
  const schema: StrapiContentTypeSchema = {
    kind: model.kind === 'collection' ? 'collectionType' : 'singleType',
    collectionName: contentTypeCollectionName(model.singularName),
    info: {
      singularName: model.singularName,
      pluralName: model.pluralName,
      displayName: model.displayName,
    },
    options: { draftAndPublish: model.draftAndPublish },
    attributes: emitAttributes(model.fields),
  };

  const result = validateContentType(schema);
  if (!result.success) {
    throw new EmitError(`Invalid content type "${model.singularName}"`, result.errors);
  }

  return {
    uid: `api::${model.singularName}.${model.singularName}`,
    singularName: model.singularName,
    path: contentTypeSchemaPath(model.singularName),
    schema,
  };
}

export function emitComponent(def: ComponentDef): EmittedComponent {
  const schema: StrapiComponentSchema = {
    collectionName: componentCollectionName(def.category, def.name),
    info: { displayName: def.displayName },
    options: {},
    attributes: emitAttributes(def.fields),
  };

  const result = validateComponent(schema);
  if (!result.success) {
    throw new EmitError(`Invalid component "${componentUid(def.category, def.name)}"`, result.errors);
  }

  return {
    uid: componentUid(def.category, def.name),
    category: def.category,
    name: def.name,
    path: componentSchemaPath(def.category, def.name),
    schema,
  };
}

/** Emit a whole IR. Throws `EmitError` on the first invalid schema. */
export function emit(ir: Ir): EmitResult {
  return {
    contentTypes: ir.models.map(emitContentType),
    components: ir.components.map(emitComponent),
  };
}

/** Canonical JSON serialisation used when writing schema files (2-space, trailing newline). */
export function serializeSchema(schema: unknown): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

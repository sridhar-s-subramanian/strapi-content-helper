import { describe, expect, it } from 'vitest';
import {
  validateComponent,
  validateContentType,
  type StrapiContentTypeSchema,
} from './validate.js';

function baseContentType(): StrapiContentTypeSchema {
  return {
    kind: 'collectionType',
    collectionName: 'articles',
    info: {
      singularName: 'article',
      pluralName: 'articles',
      displayName: 'Article',
    },
    options: { draftAndPublish: true },
    attributes: {
      title: { type: 'string', required: true },
      body: { type: 'richtext' },
      status: { type: 'enumeration', enum: ['draft', 'published'] },
      cover: { type: 'media', multiple: false, allowedTypes: ['images'] },
      blocks: { type: 'dynamiczone', components: ['sections.hero', 'sections.cta'] },
      hero: { type: 'component', repeatable: false, component: 'sections.hero' },
      author: { type: 'relation', relation: 'manyToOne', target: 'api::author.author' },
    },
  };
}

describe('validateContentType', () => {
  it('accepts a fully-featured valid content type', () => {
    const result = validateContentType(baseContentType());
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('rejects a reserved attribute name', () => {
    const ct = baseContentType();
    (ct.attributes as Record<string, unknown>).createdAt = { type: 'datetime' };
    const result = validateContentType(ct);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('reserved'))).toBe(true);
  });

  it('rejects an attribute key that is not an identifier', () => {
    const ct = baseContentType();
    (ct.attributes as Record<string, unknown>)['has space'] = { type: 'string' };
    const result = validateContentType(ct);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('valid identifier'))).toBe(true);
  });

  it('rejects singularName === pluralName', () => {
    const ct = baseContentType();
    ct.info.pluralName = 'article';
    const result = validateContentType(ct);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('must differ'))).toBe(true);
  });

  it('rejects a non-kebab singularName', () => {
    const ct = baseContentType();
    ct.info.singularName = 'Article';
    const result = validateContentType(ct);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('kebab-case'))).toBe(true);
  });

  it('rejects invalid enumeration values', () => {
    const ct = baseContentType();
    (ct.attributes as Record<string, unknown>).status = {
      type: 'enumeration',
      enum: ['1 invalid', 'ok'],
    };
    const result = validateContentType(ct);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('enumeration value'))).toBe(true);
  });

  it('rejects a malformed relation target UID', () => {
    const ct = baseContentType();
    (ct.attributes as Record<string, unknown>).author = {
      type: 'relation',
      relation: 'manyToOne',
      target: 'author',
    };
    const result = validateContentType(ct);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('relation target'))).toBe(true);
  });

  it('rejects a malformed component UID', () => {
    const ct = baseContentType();
    (ct.attributes as Record<string, unknown>).hero = {
      type: 'component',
      repeatable: false,
      component: 'Hero',
    };
    const result = validateContentType(ct);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('component UID'))).toBe(true);
  });
});

describe('validateComponent', () => {
  it('accepts a valid component', () => {
    const result = validateComponent({
      collectionName: 'components_sections_heroes',
      info: { displayName: 'Hero' },
      attributes: {
        heading: { type: 'string', required: true },
        subheading: { type: 'text' },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('rejects a reserved attribute name in a component', () => {
    const result = validateComponent({
      collectionName: 'components_sections_heroes',
      info: { displayName: 'Hero' },
      attributes: { documentId: { type: 'string' } },
    });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('reserved'))).toBe(true);
  });
});

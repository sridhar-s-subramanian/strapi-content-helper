import { describe, expect, it } from 'vitest';
import type { RawField, RawType } from './field-tree.js';
import { createInMemoryProject, readNamedType } from './type-reader.js';

/** Parse a snippet and return the field tree for the named type. */
function read(code: string, typeName = 'Props') {
  const project = createInMemoryProject({ 'test.ts': code });
  const sf = project.getSourceFileOrThrow('test.ts');
  return readNamedType(sf, typeName);
}

function field(result: ReturnType<typeof read>, name: string): RawField {
  const f = result!.object.fields.find((x) => x.name === name);
  if (!f) throw new Error(`field ${name} not found`);
  return f;
}

function typeOf(result: ReturnType<typeof read>, name: string): RawType {
  return field(result, name).type;
}

describe('type-reader', () => {
  it('maps scalars and required/optional', () => {
    const r = read(`export interface Props {
      title: string;
      count: number;
      featured: boolean;
      publishedOn: Date;
      subtitle?: string;
    }`);
    expect(typeOf(r, 'title')).toEqual({ kind: 'scalar', scalar: 'string' });
    expect(typeOf(r, 'count')).toEqual({ kind: 'scalar', scalar: 'integer' });
    expect(typeOf(r, 'featured')).toEqual({ kind: 'scalar', scalar: 'boolean' });
    expect(typeOf(r, 'publishedOn')).toEqual({ kind: 'scalar', scalar: 'datetime' });
    expect(field(r, 'title').required).toBe(true);
    expect(field(r, 'subtitle').required).toBe(false);
  });

  it('maps string-literal unions to enumerations', () => {
    const r = read(`export interface Props { size: 'sm' | 'md' | 'lg'; }`);
    expect(typeOf(r, 'size')).toEqual({ kind: 'enum', values: ['sm', 'md', 'lg'] });
  });

  it('maps nested objects to (single) components', () => {
    const r = read(`
      interface CtaProps { label: string; url: string; }
      export interface Props { cta: CtaProps; }
    `);
    const t = typeOf(r, 'cta');
    expect(t.kind).toBe('object');
    if (t.kind !== 'object') throw new Error('expected object');
    expect(t.repeatable).toBe(false);
    expect(t.object.typeName).toBe('CtaProps');
    expect(t.object.fields.map((f) => f.name)).toEqual(['label', 'url']);
  });

  it('maps object arrays to repeatable components', () => {
    const r = read(`
      interface FaqProps { question: string; answer: string; }
      export interface Props { faqs: FaqProps[]; }
    `);
    const t = typeOf(r, 'faqs');
    expect(t.kind).toBe('object');
    if (t.kind !== 'object') throw new Error('expected object');
    expect(t.repeatable).toBe(true);
    expect(t.object.typeName).toBe('FaqProps');
  });

  it('maps arrays of unions of objects to dynamic zones', () => {
    const r = read(`
      interface HeroProps { heading: string; }
      interface CtaProps { label: string; }
      export interface Props { blocks: (HeroProps | CtaProps)[]; }
    `);
    const t = typeOf(r, 'blocks');
    expect(t.kind).toBe('dynamiczone');
    if (t.kind !== 'dynamiczone') throw new Error('expected dynamiczone');
    expect(t.members.map((m) => m.typeName).sort()).toEqual(['CtaProps', 'HeroProps']);
  });

  it('detects media by url-shape, by type name, and by prop name; arrays => multiple', () => {
    const r = read(`
      interface ImageProps { url: string; alt?: string; }
      export interface Props {
        cover: ImageProps;
        avatar: { url: string };
        gallery: ImageProps[];
      }
    `);
    expect(typeOf(r, 'cover')).toEqual({ kind: 'media', multiple: false });
    expect(typeOf(r, 'avatar')).toEqual({ kind: 'media', multiple: false });
    expect(typeOf(r, 'gallery')).toEqual({ kind: 'media', multiple: true });
  });

  it('filters out UI props and functions', () => {
    const r = read(`export interface Props {
      title: string;
      className?: string;
      style?: object;
      children?: unknown;
      onClick?: () => void;
    }`);
    expect(r!.object.fields.map((f) => f.name)).toEqual(['title']);
    expect(r!.skipped.map((s) => s.name).sort()).toEqual(['children', 'className', 'onClick', 'style']);
  });

  it('honours @cms ignore, type override, and relation', () => {
    const r = read(`export interface Props {
      /** @cms ignore */
      internalId: string;
      /** @cms richtext */
      body: string;
      /** @cms relation manyToOne author */
      writer: string;
    }`);
    expect(r!.object.fields.find((f) => f.name === 'internalId')).toBeUndefined();
    expect(typeOf(r, 'body')).toEqual({ kind: 'scalar', scalar: 'richtext' });
    expect(typeOf(r, 'writer')).toEqual({
      kind: 'relation',
      cardinality: 'manyToOne',
      target: 'author',
    });
  });

  it('skips mixed unions and scalar arrays with a reason', () => {
    const r = read(`export interface Props {
      weird: string | number;
      tags: string[];
    }`);
    expect(r!.object.fields).toEqual([]);
    const reasons = Object.fromEntries(r!.skipped.map((s) => [s.name, s.reason]));
    expect(reasons.weird).toContain('union');
    expect(reasons.tags).toContain('array of scalars');
  });

  it('returns undefined for an unknown type name', () => {
    expect(read(`export interface Props { a: string }`, 'Missing')).toBeUndefined();
  });
});

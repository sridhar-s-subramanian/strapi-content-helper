import { describe, expect, it } from 'vitest';
import { discoverNext } from '../discover/next.js';
import { createInMemoryProject } from '../parse/type-reader.js';
import { buildIr, type BuildIrOptions } from './build.js';
import type { ComponentField, DynamicZoneField, RelationField } from './types.js';

function buildFrom(files: Record<string, string>, opts?: BuildIrOptions) {
  const project = createInMemoryProject(files);
  const { models } = discoverNext({ appDir: '/proj/app', project });
  return buildIr(models, opts);
}

describe('buildIr', () => {
  it('dedups a component used across multiple models to a single ComponentDef', () => {
    const hero = `interface HeroProps { heading: string; }`;
    const { ir, errors } = buildFrom({
      '/proj/app/home/page.tsx': `${hero}\nexport interface CmsContent { hero: HeroProps; }`,
      '/proj/app/about/page.tsx': `${hero}\nexport interface CmsContent { hero: HeroProps; }`,
    });
    expect(errors).toEqual([]);
    expect(ir.components.map((c) => `${c.category}.${c.name}`)).toEqual(['sections.hero']);
    expect(ir.models.map((m) => m.singularName)).toEqual(['about', 'home']);
    const field = ir.models[0].fields[0] as ComponentField;
    expect(field).toMatchObject({ type: 'component', component: 'sections.hero', repeatable: false });
  });

  it('errors when the same component name has conflicting shapes', () => {
    const { errors } = buildFrom({
      '/proj/app/home/page.tsx': `interface HeroProps { heading: string; }\nexport interface CmsContent { hero: HeroProps; }`,
      '/proj/app/about/page.tsx': `interface HeroProps { title: number; }\nexport interface CmsContent { hero: HeroProps; }`,
    });
    expect(errors.some((e) => e.includes('conflicting shapes'))).toBe(true);
  });

  it('resolves an array-of-union into a dynamic zone with both components', () => {
    const { ir } = buildFrom({
      '/proj/app/page.tsx': `
        interface HeroProps { heading: string; }
        interface CtaProps { label: string; }
        export interface CmsContent { blocks: (HeroProps | CtaProps)[]; }
      `,
    });
    const dz = ir.models[0].fields.find((f) => f.type === 'dynamiczone') as DynamicZoneField;
    expect(dz.components.sort()).toEqual(['sections.cta', 'sections.hero']);
    expect(ir.components.map((c) => `${c.category}.${c.name}`).sort()).toEqual([
      'sections.cta',
      'sections.hero',
    ]);
  });

  it('resolves a @cms relation target to a content-type UID', () => {
    const { ir } = buildFrom({
      '/proj/app/article/[slug]/page.tsx': `export interface CmsContent {
        title: string;
        /** @cms relation manyToOne author */
        writer: string;
      }`,
    });
    const rel = ir.models[0].fields.find((f) => f.type === 'relation') as RelationField;
    expect(rel).toMatchObject({ relation: 'manyToOne', target: 'api::author.author' });
  });

  it('maps media and scalars, and singularises collection names', () => {
    const { ir } = buildFrom({
      '/proj/app/posts/[slug]/page.tsx': `
        interface ImageProps { url: string; alt?: string; }
        export interface CmsContent { title: string; cover: ImageProps; }
      `,
    });
    const model = ir.models[0];
    expect(model.singularName).toBe('post');
    expect(model.pluralName).toBe('posts');
    expect(model.kind).toBe('collection');
    expect(model.fields).toEqual([
      { name: 'title', required: true, type: 'string' },
      { name: 'cover', required: true, type: 'media', multiple: false },
    ]);
  });

  it('namespaces by source when requested', () => {
    const { ir, errors } = buildFrom(
      { '/proj/app/page.tsx': `interface HeroProps { heading: string; }\nexport interface CmsContent { hero: HeroProps; }` },
      { namespaceBySource: true },
    );
    expect(errors).toEqual([]);
    expect(ir.models[0].singularName).toBe('next-home');
    expect(ir.components[0].category).toBe('next-sections');
  });
});

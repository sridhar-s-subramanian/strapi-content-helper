import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertGolden } from '../../test/golden.js';
import { fullFeaturedIr } from '../../test/ir-fixtures.js';
import { emit, serializeSchema } from './strapi-v5.js';

const goldenDir = join(fileURLToPath(new URL('.', import.meta.url)), '__goldens__');

describe('emit (Strapi v5)', () => {
  it('matches golden schema files for every field type', () => {
    const result = emit(fullFeaturedIr());

    for (const ct of result.contentTypes) {
      assertGolden(join(goldenDir, `content-types/${ct.singularName}.json`), serializeSchema(ct.schema));
    }
    for (const comp of result.components) {
      assertGolden(
        join(goldenDir, `components/${comp.category}.${comp.name}.json`),
        serializeSchema(comp.schema),
      );
    }
  });

  it('is deterministic across runs', () => {
    const a = emit(fullFeaturedIr());
    const b = emit(fullFeaturedIr());
    expect(serializeSchema(a)).toBe(serializeSchema(b));
  });

  it('derives correct UIDs, kinds, and paths', () => {
    const { contentTypes, components } = emit(fullFeaturedIr());
    const article = contentTypes.find((c) => c.singularName === 'article')!;
    const homepage = contentTypes.find((c) => c.singularName === 'homepage')!;

    expect(article.uid).toBe('api::article.article');
    expect(article.schema.kind).toBe('collectionType');
    expect(article.path).toBe('src/api/article/content-types/article/schema.json');

    expect(homepage.schema.kind).toBe('singleType');
    expect(homepage.schema.options?.draftAndPublish).toBe(false);

    const hero = components.find((c) => c.uid === 'sections.hero')!;
    expect(hero.path).toBe('src/components/sections/hero.json');
    // collectionName only needs to be deterministic + unique (Strapi reads it from the file).
    expect(hero.schema.collectionName).toBe('components_sections_heros');
  });

  it('omits required:false and includes required:true', () => {
    const { contentTypes } = emit(fullFeaturedIr());
    const article = contentTypes.find((c) => c.singularName === 'article')!;
    expect(article.schema.attributes.title).toEqual({ type: 'string', required: true });
    expect(article.schema.attributes.body).toEqual({ type: 'richtext' });
  });
});

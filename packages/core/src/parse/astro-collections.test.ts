import { describe, expect, it } from 'vitest';
import { createInMemoryProject } from './type-reader.js';
import { readAstroCollections } from './astro-collections.js';

function read(code: string) {
  const project = createInMemoryProject({ 'content.config.ts': code });
  return readAstroCollections(project.getSourceFileOrThrow('content.config.ts'));
}

describe('readAstroCollections', () => {
  it('maps a typical blog collection schema', () => {
    const cols = read(`
      import { z, defineCollection } from 'astro:content';
      const blog = defineCollection({
        type: 'content',
        schema: z.object({
          title: z.string(),
          draft: z.boolean().optional(),
          views: z.number(),
          publishedOn: z.coerce.date(),
          status: z.enum(['draft', 'published']),
        }),
      });
      export const collections = { blog };
    `);

    expect(cols).toHaveLength(1);
    expect(cols[0].name).toBe('blog');
    const fields = Object.fromEntries(cols[0].read.object.fields.map((f) => [f.name, f]));
    expect(fields.title.type).toEqual({ kind: 'scalar', scalar: 'string' });
    expect(fields.title.required).toBe(true);
    expect(fields.draft.required).toBe(false);
    expect(fields.views.type).toEqual({ kind: 'scalar', scalar: 'integer' });
    expect(fields.publishedOn.type).toEqual({ kind: 'scalar', scalar: 'datetime' });
    expect(fields.status.type).toEqual({ kind: 'enum', values: ['draft', 'published'] });
  });

  it('handles nested objects, object arrays, and the image() helper', () => {
    const cols = read(`
      import { z, defineCollection } from 'astro:content';
      const page = defineCollection({
        schema: ({ image }) => z.object({
          cover: image(),
          seo: z.object({ metaTitle: z.string() }),
          faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
        }),
      });
      export const collections = { page };
    `);

    const fields = Object.fromEntries(cols[0].read.object.fields.map((f) => [f.name, f.type]));
    expect(fields.cover).toEqual({ kind: 'media', multiple: false });
    expect(fields.seo).toMatchObject({ kind: 'object', repeatable: false });
    expect(fields.faqs).toMatchObject({ kind: 'object', repeatable: true });
  });

  it('maps a union array to a dynamic zone', () => {
    const cols = read(`
      import { z, defineCollection } from 'astro:content';
      const landing = defineCollection({
        schema: z.object({
          blocks: z.array(z.union([
            z.object({ heading: z.string() }),
            z.object({ label: z.string() }),
          ])),
        }),
      });
      export const collections = { landing };
    `);
    const blocks = cols[0].read.object.fields.find((f) => f.name === 'blocks')!;
    expect(blocks.type.kind).toBe('dynamiczone');
    if (blocks.type.kind !== 'dynamiczone') throw new Error('expected dynamiczone');
    expect(blocks.type.members).toHaveLength(2);
  });
});

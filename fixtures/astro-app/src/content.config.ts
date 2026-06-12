import { defineCollection, z } from 'astro:content';

// A content collection -> Strapi collection type "doc".
const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    order: z.number().optional(),
    category: z.enum(['guide', 'reference']),
    publishedOn: z.coerce.date(),
  }),
});

export const collections = { docs };

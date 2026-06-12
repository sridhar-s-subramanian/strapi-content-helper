/** Hand-written IR exercising every field variant — shared by emitter & merge tests. */
import type { Ir } from '../src/ir/types.js';

export function fullFeaturedIr(): Ir {
  return {
    models: [
      {
        kind: 'collection',
        singularName: 'article',
        pluralName: 'articles',
        displayName: 'Article',
        draftAndPublish: true,
        source: 'next',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'body', type: 'richtext', required: false },
          { name: 'status', type: 'enumeration', values: ['draft', 'published'], required: false },
          { name: 'views', type: 'integer', required: false },
          { name: 'featured', type: 'boolean', required: false },
          { name: 'releaseDate', type: 'datetime', required: false },
          { name: 'cover', type: 'media', multiple: false, allowedTypes: ['images'], required: true },
          { name: 'gallery', type: 'media', multiple: true, required: false },
          { name: 'hero', type: 'component', component: 'sections.hero', repeatable: false, required: false },
          { name: 'faqs', type: 'component', component: 'sections.faq', repeatable: true, required: false },
          {
            name: 'blocks',
            type: 'dynamiczone',
            components: ['sections.hero', 'sections.cta'],
            required: false,
          },
          { name: 'author', type: 'relation', relation: 'manyToOne', target: 'api::author.author', required: false },
        ],
      },
      {
        kind: 'single',
        singularName: 'homepage',
        pluralName: 'homepages',
        displayName: 'Homepage',
        draftAndPublish: false,
        source: 'next',
        fields: [
          { name: 'tagline', type: 'string', required: false },
          {
            name: 'blocks',
            type: 'dynamiczone',
            components: ['sections.hero', 'sections.cta'],
            required: false,
          },
        ],
      },
    ],
    components: [
      {
        category: 'sections',
        name: 'hero',
        displayName: 'Hero',
        source: 'next',
        fields: [
          { name: 'heading', type: 'string', required: true },
          { name: 'subheading', type: 'text', required: false },
          // nested component reference
          { name: 'cta', type: 'component', component: 'sections.cta', repeatable: false, required: false },
        ],
      },
      {
        category: 'sections',
        name: 'cta',
        displayName: 'Call To Action',
        source: 'next',
        fields: [
          { name: 'label', type: 'string', required: true },
          { name: 'url', type: 'string', required: true },
        ],
      },
      {
        category: 'sections',
        name: 'faq',
        displayName: 'FAQ',
        source: 'next',
        fields: [
          { name: 'question', type: 'string', required: true },
          { name: 'answer', type: 'richtext', required: true },
        ],
      },
    ],
  };
}

import type { ImageProps, SeoProps } from '../../../components/blocks';

// Dynamic route -> collection type "blog".
export interface CmsContent {
  title: string;
  /** @cms richtext */
  body: string;
  cover: ImageProps;
  publishedOn?: Date;
  status: 'draft' | 'published';
  seo: SeoProps;
  /** @cms relation manyToOne author */
  author: string;
}

export default function BlogPostPage() {
  return null;
}

import type { FaqProps, HeroProps, SeoProps } from '../../components/blocks';

// Static route -> single type "about".
export interface CmsContent {
  seo: SeoProps;
  hero: HeroProps;
  faqs: FaqProps[];
  /** @cms richtext */
  body: string;
}

export default function AboutPage() {
  return null;
}

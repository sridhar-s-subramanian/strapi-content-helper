import type { CtaProps, HeroProps, SeoProps } from '../components/blocks';

// Home page (static route) -> single type "home" with a storyboard dynamic zone.
export interface CmsContent {
  seo: SeoProps;
  blocks: (HeroProps | CtaProps)[];
}

export default function HomePage() {
  return null;
}

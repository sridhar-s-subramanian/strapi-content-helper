// Shared storyboard component prop types, referenced by page CmsContent markers.

export interface ImageProps {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface CtaProps {
  label: string;
  url: string;
}

export interface HeroProps {
  heading: string;
  subheading?: string;
  image?: ImageProps;
  cta?: CtaProps;
}

export interface FaqProps {
  question: string;
  answer: string;
}

export interface SeoProps {
  metaTitle: string;
  metaDescription?: string;
  ogImage?: ImageProps;
}

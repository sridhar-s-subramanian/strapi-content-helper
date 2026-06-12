export interface ImageProps {
  url: string;
  alt?: string;
  width?: number;
}

export interface CtaProps {
  label: string;
  url: string;
}

export interface HeroProps {
  heading: string;
  subheading?: string;
  image?: ImageProps;
}

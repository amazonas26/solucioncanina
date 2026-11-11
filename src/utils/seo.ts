import { withTrailingSlash } from './paths';
import { stripInlineMarkdown } from './inlineMarkdown';

export const SITE_URL = 'https://www.solucioncanina.es';
export const SITE_NAME = 'Solución Canina';
export const SITE_LOGO = `${SITE_URL}/logo.png`;
export const ORG_EMAIL = 'hola@solucioncanina.es';
/** Teal del logo (`primary-500`) — chrome del navegador y manifest. */
export const THEME_COLOR = '#3C9E91';

export type SocialProfileName = 'Pinterest' | 'Instagram' | 'Facebook';

/**
 * Perfiles sociales públicos (footer + `Organization.sameAs`).
 * Para activar Facebook, descomenta la entrada del array.
 */
export const SOCIAL_PROFILES: { name: SocialProfileName; href: string }[] = [
  { name: 'Pinterest', href: 'https://www.pinterest.com/solucioncanina' },
  { name: 'Instagram', href: 'https://www.instagram.com/solucioncanina_es' },
  // { name: 'Facebook', href: 'https://www.facebook.com/solucioncanina' },
];

export function absUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = withTrailingSlash(path.startsWith('/') ? path : `/${path}`);
  return `${SITE_URL}${clean}`;
}

function parsePrice(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n.toFixed(2) : undefined;
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: SITE_LOGO,
    email: ORG_EMAIL,
    sameAs: SOCIAL_PROFILES.map((profile) => profile.href),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'es-ES',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/productos/?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function webPageSchema(input: {
  name: string;
  description?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: absUrl(input.url),
    inLanguage: 'es-ES',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(it.url),
    })),
  };
}

export interface ArticleInput {
  title: string;
  description?: string;
  image?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  section?: string;
}

export function articleSchema(input: ArticleInput) {
  const now = new Date().toISOString();
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    image: input.image ? absUrl(input.image) : SITE_LOGO,
    datePublished: input.datePublished ?? now,
    dateModified: input.dateModified ?? input.datePublished ?? now,
    author: {
      '@type': input.author ? 'Person' : 'Organization',
      name: input.author ?? SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: SITE_LOGO },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl(input.url) },
    articleSection: input.section,
    inLanguage: 'es-ES',
  };
}

export interface ProductInput {
  name: string;
  description?: string;
  image?: string;
  brand?: string;
  sku?: string;
  url: string;
  price?: string;
  priceOriginal?: string;
  availability?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
  pros?: string[];
  cons?: string[];
  reviewBody?: string;
}

export function productSchema(input: ProductInput) {
  const price = parsePrice(input.price);
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image ? absUrl(input.image) : SITE_LOGO,
    sku: input.sku,
    category: input.category,
    brand: input.brand
      ? { '@type': 'Brand', name: input.brand }
      : undefined,
  };

  if (price) {
    schema.offers = {
      '@type': 'Offer',
      url: absUrl(input.url),
      price,
      priceCurrency: 'EUR',
      availability: input.availability ?? 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    };
  }

  if (input.rating && input.ratingCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.rating,
      reviewCount: input.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (input.reviewBody || (input.pros && input.pros.length) || (input.cons && input.cons.length)) {
    schema.review = {
      '@type': 'Review',
      reviewRating: input.rating ? {
        '@type': 'Rating',
        ratingValue: input.rating,
        bestRating: 5,
      } : undefined,
      author: {
        '@type': 'Organization',
        name: SITE_NAME,
      },
      reviewBody: input.reviewBody,
      positiveNotes: input.pros && input.pros.length > 0 ? {
        '@type': 'ItemList',
        itemListElement: input.pros.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p
        }))
      } : undefined,
      negativeNotes: input.cons && input.cons.length > 0 ? {
        '@type': 'ItemList',
        itemListElement: input.cons.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c
        }))
      } : undefined,
    };
  }

  return schema;
}

export interface ListItem {
  name: string;
  url: string;
  image?: string;
}

export interface CollectionPageInput {
  name: string;
  description?: string;
  url: string;
  numberOfItems?: number;
  items?: ListItem[];
}

export function collectionPageSchema(input: CollectionPageInput) {
  const items = input.items;
  const mainEntity = items && items.length > 0
    ? {
        '@type': 'ItemList',
        name: input.name,
        numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absUrl(it.url),
          name: it.name,
        })),
      }
    : input.numberOfItems !== undefined
      ? {
          '@type': 'ItemList',
          numberOfItems: input.numberOfItems,
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absUrl(input.url),
    inLanguage: 'es-ES',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    ...(mainEntity && { mainEntity }),
  };
}

export interface FaqItem {
  pregunta: string;
  respuesta: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.pregunta,
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripInlineMarkdown(it.respuesta),
      },
    })),
  };
}

export function itemListSchema(items: ListItem[], name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absUrl(it.url),
      name: it.name,
    })),
  };
}

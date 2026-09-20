export const BLOG_HEADER_SLUGS = [
  'labrador-retriever-como-cuidar-en-casa',
  'bozales-perros-guia-elegir-talla',
] as const;

export type BlogHeaderSlug = (typeof BLOG_HEADER_SLUGS)[number];

export function hasBlogHeader(slug: string): slug is BlogHeaderSlug {
  return (BLOG_HEADER_SLUGS as readonly string[]).includes(slug);
}

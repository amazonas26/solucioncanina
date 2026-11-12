/** Cabeceras tipográficas (B) del blog.
 *  En UI (tarjetas): fondo plano con eyebrow + lines en grande; el título completo va en HTML.
 *  En la página del artículo no se muestran (solo fotos reales).
 *  Fotos (C): WebP en `public/images/blog/<slug>.webp` + frontmatter `imagen`; fuera de este registro.
 *  Diagramas de contenido (medir hocico/cama, ángulo rampa) no pasan por aquí.
 */

export type Campo =
  | 'mint-dots'
  | 'blue-dots'
  | 'warm-hill'
  | 'mint-bands'
  | 'mint-bigdots'
  | 'blue-arc'
  | 'warm-dots'
  | 'mint-circles'
  | 'blue-bands'
  | 'cream-dots'
  | 'warm-arc'
  | 'blue-circles';

export interface TypographicSpec {
  style: 'typographic';
  eyebrow: string;
  lines: string[];
  campo: Campo;
  desc: string;
}

export type HeaderSpec = TypographicSpec;

export const BLOG_HEADERS = {
} satisfies Record<string, HeaderSpec>;

export type BlogHeaderSlug = keyof typeof BLOG_HEADERS;

export function hasBlogHeader(slug: string): slug is BlogHeaderSlug {
  return Object.prototype.hasOwnProperty.call(BLOG_HEADERS, slug);
}

export function isTypographicHeader(slug: string): boolean {
  return hasBlogHeader(slug);
}

/** @deprecated El motor de ilustración compuesto se retiró. */
export function isIllustrationHeader(_slug: string): boolean {
  return false;
}

/** @deprecated */
export function isBespokeHeader(_slug: string): boolean {
  return false;
}

export function composedHeaderSlugs(): BlogHeaderSlug[] {
  return Object.keys(BLOG_HEADERS) as BlogHeaderSlug[];
}

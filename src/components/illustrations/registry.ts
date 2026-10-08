/** Cabeceras tipográficas (B) del blog.
 *  En UI: solo fondo geométrico de marca (sin título — ya va en HTML).
 *  eyebrow/lines solo para og:image vía `renderBlogHeader(..., { og: true })`.
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
  // —— Decisión / comparativa ——
  'arnes-o-collar-perros-guia': {
    style: 'typographic',
    eyebrow: 'Guías',
    lines: ['Arnés o collar:', 'qué elegir'],
    campo: 'mint-bands',
    desc: 'Cabecera tipográfica: arnés frente a collar.',
  },
  'pienso-con-condroprotectores-o-suplemento': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['¿Pienso con condro', 'o suplemento?'],
    campo: 'cream-dots',
    desc: 'Cabecera tipográfica: pienso con condro frente a suplemento.',
  },
  'pastillas-perros-artrosis-comprimidos-gotas-snacks': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Comprimidos, gotas', 'o snacks'],
    campo: 'cream-dots',
    desc: 'Cabecera tipográfica: formatos de pastillas para artrosis.',
  },
  'relajantes-naturales-perros-gotas-feromonas-chaleco': {
    style: 'typographic',
    eyebrow: 'Comportamiento',
    lines: ['Gotas, feromonas', 'o chaleco'],
    campo: 'blue-dots',
    desc: 'Cabecera tipográfica: relajantes naturales comparados.',
  },
  'mejores-correas-largas-perros-adiestramiento': {
    style: 'typographic',
    eyebrow: 'Guías',
    lines: ['Mejores correas', 'largas'],
    campo: 'warm-dots',
    desc: 'Cabecera tipográfica: correas largas para adiestramiento.',
  },
  'mejor-condroprotector-perros-artrosis': {
    style: 'typographic',
    eyebrow: 'Guías',
    lines: ['Elegir el mejor', 'condroprotector'],
    campo: 'mint-dots',
    desc: 'Cabecera tipográfica: cómo elegir condroprotector.',
  },
  'bozales-perros-guia-elegir-talla': {
    style: 'typographic',
    eyebrow: 'Comportamiento',
    lines: ['Bozales: uso,', 'talla y criterio'],
    campo: 'blue-dots',
    desc: 'Cabecera tipográfica: guía de bozales.',
  },

  // —— Salud / condición / ansiedad ——
  'condroprotectores-perros-guia-completa': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Condroprotectores:', 'cuándo empezar'],
    campo: 'mint-circles',
    desc: 'Cabecera tipográfica: guía de condroprotectores.',
  },
  'glucosamina-para-perros-para-que-sirve-dosis': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Glucosamina:', 'para qué y dosis'],
    campo: 'cream-dots',
    desc: 'Cabecera tipográfica: glucosamina para perros.',
  },
  'displasia-cadera-perros-sintomas-cuidados': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Displasia de cadera:', 'síntomas y cuidados'],
    campo: 'blue-bands',
    desc: 'Cabecera tipográfica: displasia de cadera.',
  },
  'pienso-renal-perros-guia': {
    style: 'typographic',
    eyebrow: 'Alimentación',
    lines: ['Pienso renal:', 'qué debes saber'],
    campo: 'warm-hill',
    desc: 'Cabecera tipográfica: pienso renal.',
  },
  'pienso-bajo-sodio-perros-renal': {
    style: 'typographic',
    eyebrow: 'Alimentación',
    lines: ['Pienso bajo en', 'sodio y fósforo'],
    campo: 'cream-dots',
    desc: 'Cabecera tipográfica: pienso bajo en sodio.',
  },
  'como-mejorar-movilidad-perro-mayor': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Movilidad en un', 'perro mayor'],
    campo: 'warm-dots',
    desc: 'Cabecera tipográfica: movilidad del perro mayor.',
  },
  'mi-perro-se-rasca-mucho-sin-pulgas-causas': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Se rasca mucho', 'sin pulgas'],
    campo: 'warm-arc',
    desc: 'Cabecera tipográfica: prurito sin pulgas.',
  },
  'por-que-mi-perro-come-heces': {
    style: 'typographic',
    eyebrow: 'Comportamiento',
    lines: ['Por qué se come', 'las heces'],
    campo: 'mint-circles',
    desc: 'Cabecera tipográfica: coprofagia.',
  },
  'ansiedad-separacion-perros-guia': {
    style: 'typographic',
    eyebrow: 'Comportamiento',
    lines: ['Ansiedad por', 'separación'],
    campo: 'warm-hill',
    desc: 'Cabecera tipográfica: ansiedad por separación.',
  },
  'ansiedad-ruidos-perros-calmar-estres': {
    style: 'typographic',
    eyebrow: 'Comportamiento',
    lines: ['Ansiedad por', 'ruidos'],
    campo: 'mint-circles',
    desc: 'Cabecera tipográfica: ansiedad por ruidos.',
  },
  'senales-estres-perros-ansiedad': {
    style: 'typographic',
    eyebrow: 'Comportamiento',
    lines: ['Señales de estrés', 'y ansiedad'],
    campo: 'blue-dots',
    desc: 'Cabecera tipográfica: señales de estrés.',
  },
  'miedo-petardos-perros-soluciones': {
    style: 'typographic',
    eyebrow: 'Comportamiento',
    lines: ['Miedo a petardos', 'y tormentas'],
    campo: 'blue-bands',
    desc: 'Cabecera tipográfica: miedo a petardos.',
  },

  // —— Pedían foto C; sin escena Pexels suficiente → B ——
  'como-limpiar-dientes-perro-guia': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Limpiar los dientes', 'en casa'],
    campo: 'cream-dots',
    desc: 'Cabecera tipográfica: higiene dental (sin foto Pexels adecuada).',
  },
  'rampas-para-perros-beneficios': {
    style: 'typographic',
    eyebrow: 'Salud',
    lines: ['Rampas para perros:', 'proteger la espalda'],
    campo: 'mint-dots',
    desc: 'Cabecera tipográfica: rampas (sin foto de rampa real en Pexels).',
  },
  'mi-perro-no-quiere-comer-causas': {
    style: 'typographic',
    eyebrow: 'Alimentación',
    lines: ['Mi perro no', 'quiere comer'],
    campo: 'blue-circles',
    desc: 'Cabecera tipográfica: inapetencia (fotos disponibles solo de perros comiendo).',
  },
  'aceite-salmon-perros-beneficios': {
    style: 'typographic',
    eyebrow: 'Alimentación',
    lines: ['Aceite de salmón:', 'beneficios'],
    campo: 'blue-arc',
    desc: 'Cabecera tipográfica: aceite de salmón (sin escena doméstica sin marca).',
  },
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

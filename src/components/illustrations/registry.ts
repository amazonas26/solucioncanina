/** Cabeceras del blog: ilustración (A) o tipográfica (B).
 *  Las guías de raza llevan `photoPending` y usan B temporal hasta foto con licencia.
 */

export type HeaderStyle = 'illustration' | 'typographic';

export type Silueta =
  | 'labrador'
  | 'golden'
  | 'pastor'
  | 'bulldog'
  | 'collie'
  | 'medio'
  | 'senior'
  | 'pequeno';

export type Pose =
  | 'sentado'
  | 'de-pie'
  | 'andando'
  | 'echado'
  | 'agachado'
  | 'rascandose'
  | 'tirando'
  | 'hocico-bajo';

export type Motivo =
  | 'comedero'
  | 'bozal'
  | 'cepillo'
  | 'cadera'
  | 'rampa'
  | 'casa'
  | 'chaleco-gotero'
  | 'saco-bote'
  | 'saco-gota'
  | 'marcas'
  | 'bote'
  | 'pastilla'
  | 'saco-cuenco'
  | 'cama'
  | 'aceite'
  | 'arnes'
  | 'ondas'
  | 'estrellas'
  | 'tres-formatos'
  | 'escalon'
  | 'cuenco'
  | 'marca-suelo'
  | 'segundo-perro'
  | 'cepillo-dientes'
  | 'correa'
  | 'correa-larga';

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

export interface IllustrationSpec {
  style: 'illustration';
  silueta: Silueta;
  pose: Pose;
  motivo: Motivo;
  campo: Campo;
  desc: string;
}

export interface TypographicSpec {
  style: 'typographic';
  eyebrow: string;
  lines: string[];
  campo: Campo;
  desc: string;
}

export type HeaderSpec = IllustrationSpec | TypographicSpec;

const PLANA = 'silueta en capas en los colores de Solución Canina';

export const BLOG_HEADERS = {
  // Guías de raza (C): foto WebP en `public/images/blog/<slug>.webp` vía frontmatter `imagen`.
  // No van aquí — ver scratch/imagenes-pendientes.md.

  // —— B tipográficas (decisión / comparativa) ——
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
  'mejores-camas-ortopedicas-perros': {
    style: 'typographic',
    eyebrow: 'Guías',
    lines: ['Camas ortopédicas:', 'guía 2026'],
    campo: 'warm-arc',
    desc: 'Cabecera tipográfica: guía de camas ortopédicas.',
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

  // —— A ilustraciones (salud / condición / uso) ——
  'bozales-perros-guia-elegir-talla': {
    style: 'illustration',
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'bozal',
    campo: 'blue-dots',
    desc: `Perro sentado de perfil con bozal de cesta, ${PLANA}.`,
  },
  'condroprotectores-perros-guia-completa': {
    style: 'illustration',
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'bote',
    campo: 'mint-circles',
    desc: `Perro sentado junto a un bote de suplemento, ${PLANA}.`,
  },
  'mi-perro-se-rasca-mucho-sin-pulgas-causas': {
    style: 'illustration',
    silueta: 'collie',
    pose: 'rascandose',
    motivo: 'marcas',
    campo: 'warm-arc',
    desc: `Perro rascándose el cuello, sin insectos, ${PLANA}.`,
  },
  'glucosamina-para-perros-para-que-sirve-dosis': {
    style: 'illustration',
    silueta: 'medio',
    pose: 'de-pie',
    motivo: 'pastilla',
    campo: 'cream-dots',
    desc: `Perro de pie junto a un comprimido, ${PLANA}.`,
  },
  'como-evitar-que-mi-perro-suelte-pelo': {
    style: 'illustration',
    silueta: 'golden',
    pose: 'sentado',
    motivo: 'cepillo',
    campo: 'blue-circles',
    desc: `Golden sentado junto a un cepillo, ${PLANA}.`,
  },
  'pienso-renal-perros-guia': {
    style: 'illustration',
    silueta: 'bulldog',
    pose: 'de-pie',
    motivo: 'saco-cuenco',
    campo: 'warm-hill',
    desc: `Bulldog de pie junto a un saco y un cuenco, ${PLANA}.`,
  },
  'pienso-bajo-sodio-perros-renal': {
    style: 'illustration',
    silueta: 'bulldog',
    pose: 'sentado',
    motivo: 'saco-cuenco',
    campo: 'cream-dots',
    desc: `Bulldog sentado junto a un saco y un cuenco, ${PLANA}.`,
  },
  'displasia-cadera-perros-sintomas-cuidados': {
    style: 'illustration',
    silueta: 'pastor',
    pose: 'echado',
    motivo: 'cadera',
    campo: 'blue-bands',
    desc: `Pastor echado con la cadera marcada, ${PLANA}.`,
  },
  'rampas-para-perros-beneficios': {
    style: 'illustration',
    silueta: 'senior',
    pose: 'andando',
    motivo: 'rampa',
    campo: 'mint-dots',
    desc: `Perro mayor andando hacia una rampa, ${PLANA}.`,
  },
  'camas-ortopedicas-perros-artrosis-displasia': {
    style: 'illustration',
    silueta: 'senior',
    pose: 'echado',
    motivo: 'cama',
    campo: 'mint-bigdots',
    desc: `Perro mayor echado junto a una cama con borde, ${PLANA}.`,
  },
  'senales-estres-perros-ansiedad': {
    style: 'illustration',
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'ondas',
    campo: 'blue-dots',
    desc: `Perro sentado con ondas de tensión a un lado, ${PLANA}.`,
  },
  'ansiedad-ruidos-perros-calmar-estres': {
    style: 'illustration',
    silueta: 'bulldog',
    pose: 'agachado',
    motivo: 'ondas',
    campo: 'mint-circles',
    desc: `Bulldog agachado junto a ondas de ruido, ${PLANA}.`,
  },
  'ansiedad-separacion-perros-guia': {
    style: 'illustration',
    silueta: 'pequeno',
    pose: 'sentado',
    motivo: 'casa',
    campo: 'warm-hill',
    desc: `Perro pequeño sentado frente a una casa, ${PLANA}.`,
  },
  'miedo-petardos-perros-soluciones': {
    style: 'illustration',
    silueta: 'pequeno',
    pose: 'agachado',
    motivo: 'estrellas',
    campo: 'blue-bands',
    desc: `Perro pequeño agachado bajo unas estrellas, ${PLANA}.`,
  },
  'aceite-salmon-perros-beneficios': {
    style: 'illustration',
    silueta: 'golden',
    pose: 'hocico-bajo',
    motivo: 'aceite',
    campo: 'blue-arc',
    desc: `Golden con el hocico bajo junto a un frasco de aceite, ${PLANA}.`,
  },
  'como-mejorar-movilidad-perro-mayor': {
    style: 'illustration',
    silueta: 'senior',
    pose: 'de-pie',
    motivo: 'escalon',
    campo: 'warm-dots',
    desc: `Perro mayor de pie junto a un escalón bajo, ${PLANA}.`,
  },
  'mi-perro-no-quiere-comer-causas': {
    style: 'illustration',
    silueta: 'labrador',
    pose: 'hocico-bajo',
    motivo: 'cuenco',
    campo: 'blue-circles',
    desc: `Labrador con el hocico bajo frente a un cuenco, ${PLANA}.`,
  },
  'por-que-mi-perro-come-heces': {
    style: 'illustration',
    silueta: 'collie',
    pose: 'hocico-bajo',
    motivo: 'marca-suelo',
    campo: 'mint-circles',
    desc: `Collie con el hocico junto a una marca en el suelo, ${PLANA}.`,
  },
  'como-socializar-perro-adulto-guia': {
    style: 'illustration',
    silueta: 'medio',
    pose: 'de-pie',
    motivo: 'segundo-perro',
    campo: 'warm-arc',
    desc: `Dos perros de pie, uno frente al otro, ${PLANA}.`,
  },
  'como-limpiar-dientes-perro-guia': {
    style: 'illustration',
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'cepillo-dientes',
    campo: 'cream-dots',
    desc: `Perro sentado junto a un cepillo de dientes, ${PLANA}.`,
  },
  'perro-tira-de-la-correa-soluciones': {
    style: 'illustration',
    silueta: 'pastor',
    pose: 'tirando',
    motivo: 'correa',
    campo: 'blue-circles',
    desc: `Pastor inclinándose hacia delante con la correa tensa, ${PLANA}.`,
  },
} satisfies Record<string, HeaderSpec>;

export type BlogHeaderSlug = keyof typeof BLOG_HEADERS;

export function hasBlogHeader(slug: string): slug is BlogHeaderSlug {
  return Object.prototype.hasOwnProperty.call(BLOG_HEADERS, slug);
}

export function isTypographicHeader(slug: string): boolean {
  return hasBlogHeader(slug) && BLOG_HEADERS[slug].style === 'typographic';
}

export function isIllustrationHeader(slug: string): boolean {
  return hasBlogHeader(slug) && BLOG_HEADERS[slug].style === 'illustration';
}

/** @deprecated Las cabeceras bespoke se retiraron; todo pasa por compose. */
export function isBespokeHeader(_slug: string): boolean {
  return false;
}

export function composedHeaderSlugs(): BlogHeaderSlug[] {
  return Object.keys(BLOG_HEADERS) as BlogHeaderSlug[];
}

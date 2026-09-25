/** Cabeceras del blog: silueta × pose × motivo × campo.
 *  `bespoke` conserva el SVG dibujado a mano. El resto lo compone `compose.ts`.
 */
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

export interface HeaderSpec {
  silueta: Silueta;
  pose: Pose;
  motivo: Motivo;
  campo: Campo;
  desc: string;
  bespoke?: true;
}

const PLANA = 'silueta plana en los colores de Solución Canina';

export const BLOG_HEADERS = {
  // Dibujadas a mano. No repetir esta combinación en las compuestas.
  'labrador-retriever-como-cuidar-en-casa': {
    bespoke: true,
    silueta: 'labrador',
    pose: 'sentado',
    motivo: 'comedero',
    campo: 'mint-dots',
    desc: `Labrador sentado junto a un comedero, ${PLANA}.`,
  },
  'bozales-perros-guia-elegir-talla': {
    bespoke: true,
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'bozal',
    campo: 'blue-dots',
    desc: `Perro sentado de perfil con bozal de cesta, ${PLANA}.`,
  },
  'golden-retriever-guia-cuidados-completa': {
    bespoke: true,
    silueta: 'golden',
    pose: 'de-pie',
    motivo: 'cepillo',
    campo: 'warm-hill',
    desc: `Golden Retriever de pie junto a un cepillo, ${PLANA}.`,
  },
  'pastor-aleman-cuidados-displasia-comportamiento': {
    bespoke: true,
    silueta: 'pastor',
    pose: 'andando',
    motivo: 'cadera',
    campo: 'mint-bands',
    desc: `Pastor Alemán andando de perfil, con la cadera marcada, ${PLANA}.`,
  },
  'bulldog-frances-cuidados-problemas-salud': {
    bespoke: true,
    silueta: 'bulldog',
    pose: 'echado',
    motivo: 'rampa',
    campo: 'mint-bigdots',
    desc: `Bulldog Francés echado junto a una rampa baja, ${PLANA}.`,
  },
  'border-collie-cuidados-problemas-comportamiento': {
    bespoke: true,
    silueta: 'collie',
    pose: 'agachado',
    motivo: 'casa',
    campo: 'blue-arc',
    desc: `Border Collie agachado frente a una casa, ${PLANA}.`,
  },

  // Las tres guías de la home (relajantes, pienso con condroprotectores,
  // pienso bajo en sodio) usan foto real en `imagen`. No van aquí.

  // Con impresiones en Search Console.
  'condroprotectores-perros-guia-completa': {
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'bote',
    campo: 'mint-circles',
    desc: `Perro sentado junto a un bote de suplemento, ${PLANA}.`,
  },
  'mi-perro-se-rasca-mucho-sin-pulgas-causas': {
    silueta: 'collie',
    pose: 'rascandose',
    motivo: 'marcas',
    campo: 'warm-arc',
    desc: `Perro rascándose el cuello, sin insectos, ${PLANA}.`,
  },
  'glucosamina-para-perros-para-que-sirve-dosis': {
    silueta: 'medio',
    pose: 'de-pie',
    motivo: 'pastilla',
    campo: 'cream-dots',
    desc: `Perro de pie junto a un comprimido, ${PLANA}.`,
  },
  'como-evitar-que-mi-perro-suelte-pelo': {
    silueta: 'golden',
    pose: 'sentado',
    motivo: 'cepillo',
    campo: 'blue-circles',
    desc: `Golden sentado junto a un cepillo, ${PLANA}.`,
  },
  'pienso-renal-perros-guia': {
    silueta: 'bulldog',
    pose: 'de-pie',
    motivo: 'saco-cuenco',
    campo: 'warm-hill',
    desc: `Bulldog de pie junto a un saco y un cuenco, ${PLANA}.`,
  },
  'displasia-cadera-perros-sintomas-cuidados': {
    silueta: 'pastor',
    pose: 'echado',
    motivo: 'cadera',
    campo: 'blue-bands',
    desc: `Pastor echado con la cadera marcada, ${PLANA}.`,
  },
  'rampas-para-perros-beneficios': {
    silueta: 'senior',
    pose: 'andando',
    motivo: 'rampa',
    campo: 'mint-dots',
    desc: `Perro mayor andando hacia una rampa, ${PLANA}.`,
  },
  'camas-ortopedicas-perros-artrosis-displasia': {
    silueta: 'senior',
    pose: 'echado',
    motivo: 'cama',
    campo: 'mint-bigdots',
    desc: `Perro mayor echado junto a una cama con borde, ${PLANA}.`,
  },
  'senales-estres-perros-ansiedad': {
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'ondas',
    campo: 'blue-dots',
    desc: `Perro sentado con ondas de tensión a un lado, ${PLANA}.`,
  },
  'ansiedad-ruidos-perros-calmar-estres': {
    silueta: 'bulldog',
    pose: 'agachado',
    motivo: 'ondas',
    campo: 'mint-circles',
    desc: `Bulldog agachado junto a ondas de ruido, ${PLANA}.`,
  },
  'ansiedad-separacion-perros-guia': {
    silueta: 'pequeno',
    pose: 'sentado',
    motivo: 'casa',
    campo: 'warm-hill',
    desc: `Perro pequeño sentado frente a una casa, ${PLANA}.`,
  },
  'miedo-petardos-perros-soluciones': {
    silueta: 'pequeno',
    pose: 'agachado',
    motivo: 'estrellas',
    campo: 'blue-bands',
    desc: `Perro pequeño agachado bajo unas estrellas, ${PLANA}.`,
  },
  'aceite-salmon-perros-beneficios': {
    silueta: 'golden',
    pose: 'hocico-bajo',
    motivo: 'aceite',
    campo: 'blue-arc',
    desc: `Golden con el hocico bajo junto a un frasco de aceite, ${PLANA}.`,
  },
  'arnes-o-collar-perros-guia': {
    silueta: 'collie',
    pose: 'de-pie',
    motivo: 'arnes',
    campo: 'mint-bands',
    desc: `Collie de pie junto a un arnés y un collar, ${PLANA}.`,
  },

  // Resto de artículos que aún usaban foto de stock o no tenían imagen.
  'pastillas-perros-artrosis-comprimidos-gotas-snacks': {
    silueta: 'senior',
    pose: 'sentado',
    motivo: 'tres-formatos',
    campo: 'cream-dots',
    desc: `Perro mayor sentado junto a un comprimido, un gotero y un snack, ${PLANA}.`,
  },
  'como-mejorar-movilidad-perro-mayor': {
    silueta: 'senior',
    pose: 'de-pie',
    motivo: 'escalon',
    campo: 'warm-dots',
    desc: `Perro mayor de pie junto a un escalón bajo, ${PLANA}.`,
  },
  'mejores-camas-ortopedicas-perros': {
    silueta: 'golden',
    pose: 'echado',
    motivo: 'cama',
    campo: 'warm-arc',
    desc: `Golden echado junto a una cama con borde, ${PLANA}.`,
  },
  'mejor-condroprotector-perros-artrosis': {
    silueta: 'collie',
    pose: 'sentado',
    motivo: 'bote',
    campo: 'mint-dots',
    desc: `Collie sentado junto a un bote de suplemento, ${PLANA}.`,
  },
  'mi-perro-no-quiere-comer-causas': {
    silueta: 'labrador',
    pose: 'hocico-bajo',
    motivo: 'cuenco',
    campo: 'blue-circles',
    desc: `Labrador con el hocico bajo frente a un cuenco, ${PLANA}.`,
  },
  'por-que-mi-perro-come-heces': {
    silueta: 'collie',
    pose: 'hocico-bajo',
    motivo: 'marca-suelo',
    campo: 'mint-circles',
    desc: `Collie con el hocico junto a una marca en el suelo, ${PLANA}.`,
  },
  'como-socializar-perro-adulto-guia': {
    silueta: 'medio',
    pose: 'de-pie',
    motivo: 'segundo-perro',
    campo: 'warm-arc',
    desc: `Dos perros de pie, uno frente al otro, ${PLANA}.`,
  },
  'como-limpiar-dientes-perro-guia': {
    silueta: 'medio',
    pose: 'sentado',
    motivo: 'cepillo-dientes',
    campo: 'cream-dots',
    desc: `Perro sentado junto a un cepillo de dientes, ${PLANA}.`,
  },
  'perro-tira-de-la-correa-soluciones': {
    silueta: 'pastor',
    pose: 'tirando',
    motivo: 'correa',
    campo: 'blue-circles',
    desc: `Pastor inclinándose hacia delante con la correa tensa, ${PLANA}.`,
  },
  'mejores-correas-largas-perros-adiestramiento': {
    silueta: 'pastor',
    pose: 'andando',
    motivo: 'correa-larga',
    campo: 'warm-dots',
    desc: `Pastor andando junto a una correa enrollada, ${PLANA}.`,
  },
} satisfies Record<string, HeaderSpec>;

export type BlogHeaderSlug = keyof typeof BLOG_HEADERS;

export function hasBlogHeader(slug: string): slug is BlogHeaderSlug {
  return Object.prototype.hasOwnProperty.call(BLOG_HEADERS, slug);
}

export function isBespokeHeader(slug: string): slug is BlogHeaderSlug {
  return hasBlogHeader(slug) && BLOG_HEADERS[slug].bespoke === true;
}

export function composedHeaderSlugs(): BlogHeaderSlug[] {
  return (Object.keys(BLOG_HEADERS) as BlogHeaderSlug[]).filter((slug) => !BLOG_HEADERS[slug].bespoke);
}

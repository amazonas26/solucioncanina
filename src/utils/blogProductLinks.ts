// Mapeig topical entre un blog post i una categoria de producte.
// S'usa per generar enllaços interns blog → producte i producte → blog.
// El bloc de productes d'un post pot sobreescriure aquest mapeig amb
// `productosRecomendados` / `productosExcluidos` al frontmatter.

import { slugify } from './slugify';

export const BLOG_TO_PRODUCT_CATEGORY: Record<string, string> = {
  'como-mejorar-movilidad-perro-mayor': 'Condroprotectores',
  'pastillas-perros-artrosis-comprimidos-gotas-snacks': 'Condroprotectores',
  'pienso-con-condroprotectores-o-suplemento': 'Condroprotectores',
  'mejor-condroprotector-perros-artrosis': 'Condroprotectores',
  'condroprotectores-perros-guia-completa': 'Condroprotectores',
  'glucosamina-para-perros-para-que-sirve-dosis': 'Condroprotectores',
  'rampas-para-perros-beneficios': 'Rampas',
  'pienso-renal-perros-guia': 'Alimentación específica',
  'pienso-bajo-sodio-perros-renal': 'Alimentación específica',
  'perro-diarrea-que-hacer-dieta': 'Alimentación específica',
  'aceite-salmon-perros-beneficios': 'Omega-3 y aceite de salmón',
  'ansiedad-ruidos-perros-calmar-estres': 'Ansiedad',
  'ansiedad-separacion-perros-guia': 'Ansiedad',
  'relajantes-naturales-perros-gotas-feromonas-chaleco': 'Ansiedad',
  'perro-tira-de-la-correa-soluciones': 'Arneses',
  'arnes-o-collar-perros-guia': 'Arneses',
  'arnes-perro-como-elegir-talla': 'Arneses',
  'como-evitar-que-mi-perro-suelte-pelo': 'Piel y pelo',
  'mi-perro-se-rasca-mucho-sin-pulgas-causas': 'Piel y pelo',
  'juguetes-interactivos-perros-aburrimiento': 'Juguetes interactivos',
  'incontinencia-perro-mayor-panales': 'Incontinencia',
  'mejores-correas-largas-perros-adiestramiento': 'Correas',
  'bozales-perros-guia-elegir-talla': 'Bozales',
  'camas-ortopedicas-perros-artrosis-displasia': 'Camas ortopédicas',
  'displasia-cadera-perros-sintomas-cuidados': 'Camas ortopédicas',
};

export const PRODUCT_CATEGORY_TO_BLOGS: Record<string, { slug: string; titulo: string }[]> = {
  'Condroprotectores': [
    { slug: 'mejor-condroprotector-perros-artrosis', titulo: 'Mejor condroprotector para perros: comparativa de 11' },
    { slug: 'condroprotectores-perros-guia-completa', titulo: 'Qué son los condroprotectores y cuándo darlos' },
    { slug: 'glucosamina-para-perros-para-que-sirve-dosis', titulo: 'Glucosamina para perros: para qué sirve y dosis' },
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
    { slug: 'pastillas-perros-artrosis-comprimidos-gotas-snacks', titulo: 'Pastillas para perros con artrosis: comprimidos, gotas o snacks' },
    { slug: 'pienso-con-condroprotectores-o-suplemento', titulo: '¿Basta un pienso con condroprotectores?' },
  ],
  'Camas ortopédicas': [
    { slug: 'camas-ortopedicas-perros-artrosis-displasia', titulo: 'Camas ortopédicas: cuál elegir con artrosis, displasia o ya mayor' },
    { slug: 'displasia-cadera-perros-sintomas-cuidados', titulo: 'Displasia de cadera en perros: síntomas y cuidados' },
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
  ],
  'Bozales': [
    { slug: 'bozales-perros-guia-elegir-talla', titulo: 'Bozales para perros: guía para elegir talla y tipo' },
    { slug: 'perros-potencialmente-peligrosos-ppp-licencia-razas', titulo: 'Perros PPP: licencia, seguro, bozal y correa' },
  ],
  'Rampas': [
    { slug: 'rampas-para-perros-beneficios', titulo: 'Rampas para perros: cuándo y por qué usarlas' },
    { slug: 'teckel-cuidados-espalda-hernia-discal', titulo: 'Teckel: hernia discal y cómo cuidar su espalda' },
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
  ],
  'Movilidad y artrosis': [
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
    { slug: 'pastillas-perros-artrosis-comprimidos-gotas-snacks', titulo: 'Pastillas para perros con artrosis: comprimidos, gotas o snacks' },
    { slug: 'pienso-con-condroprotectores-o-suplemento', titulo: '¿Basta un pienso con condroprotectores?' },
    { slug: 'condroprotectores-perros-guia-completa', titulo: 'Qué son los condroprotectores y cuándo darlos' },
    { slug: 'camas-ortopedicas-perros-artrosis-displasia', titulo: 'Camas ortopédicas: cuál elegir con artrosis, displasia o ya mayor' },
    { slug: 'rampas-para-perros-beneficios', titulo: 'Rampas para perros: cuándo y por qué usarlas' },
  ],
  'Omega-3 y aceite de salmón': [
    { slug: 'aceite-salmon-perros-beneficios', titulo: 'Aceite de salmón y omega-3: para qué sirve y cuánto darle' },
    { slug: 'mejor-condroprotector-perros-artrosis', titulo: 'Mejor condroprotector para perros: comparativa' },
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
    { slug: 'mi-perro-se-rasca-mucho-sin-pulgas-causas', titulo: 'Mi perro se rasca mucho sin pulgas: causas' },
  ],
  'Alimentación específica': [
    { slug: 'pienso-renal-perros-guia', titulo: 'Pienso renal para perros: guía' },
    { slug: 'pienso-bajo-sodio-perros-renal', titulo: 'Pienso bajo en sodio (y fósforo) para problema renal' },
    { slug: 'perro-diarrea-que-hacer-dieta', titulo: 'Perro con diarrea: qué hacer y qué darle de comer' },
  ],
  'Problemas renales y urinarios': [
    { slug: 'pienso-renal-perros-guia', titulo: 'Pienso renal para perros: guía' },
    { slug: 'pienso-bajo-sodio-perros-renal', titulo: 'Pienso bajo en sodio (y fósforo) para problema renal' },
  ],
  'Digestión sensible': [
    { slug: 'perro-diarrea-que-hacer-dieta', titulo: 'Perro con diarrea: qué hacer y qué darle de comer' },
    { slug: 'mi-perro-no-quiere-comer-causas', titulo: 'Mi perro no quiere comer: causas y qué hacer' },
    { slug: 'por-que-mi-perro-come-heces', titulo: 'Por qué mi perro come heces' },
  ],
  'Ansiedad': [
    { slug: 'ansiedad-ruidos-perros-calmar-estres', titulo: 'Miedo a los petardos y a los ruidos: qué hacer' },
    { slug: 'ansiedad-separacion-perros-guia', titulo: 'Ansiedad por separación: guía para perros' },
    { slug: 'relajantes-naturales-perros-gotas-feromonas-chaleco', titulo: 'Relajantes naturales: gotas, feromonas y chaleco' },
  ],
  'Juguetes interactivos': [
    { slug: 'juguetes-interactivos-perros-aburrimiento', titulo: 'Juguetes para que tu perro no se aburra' },
    { slug: 'border-collie-cuidados-problemas-comportamiento', titulo: 'Border collie: por qué se aburre y cómo encauzarlo' },
    { slug: 'ansiedad-separacion-perros-guia', titulo: 'Ansiedad por separación: guía para perros' },
    { slug: 'senales-estres-perros-ansiedad', titulo: 'Señales de estrés en perros' },
  ],
  'Piel y pelo': [
    { slug: 'como-evitar-que-mi-perro-suelte-pelo', titulo: 'Cómo evitar que tu perro suelte tanto pelo' },
    { slug: 'mi-perro-se-rasca-mucho-sin-pulgas-causas', titulo: 'Mi perro se rasca mucho sin pulgas: causas' },
    { slug: 'aceite-salmon-perros-beneficios', titulo: 'Aceite de salmón y omega-3: para qué sirve y cuánto darle' },
  ],
  'Incontinencia': [
    { slug: 'incontinencia-perro-mayor-panales', titulo: 'Perro mayor que se hace pis: incontinencia y pañales' },
    { slug: 'camas-ortopedicas-perros-artrosis-displasia', titulo: 'Camas ortopédicas: cuál elegir con artrosis, displasia o ya mayor' },
  ],
  'Arneses': [
    { slug: 'arnes-perro-como-elegir-talla', titulo: 'Arnés para perro: qué tipo elegir y cómo medir la talla' },
    { slug: 'arnes-o-collar-perros-guia', titulo: 'Arnés o collar: qué elegir para el paseo' },
    { slug: 'perro-tira-de-la-correa-soluciones', titulo: 'Si tu perro tira de la correa: soluciones' },
  ],
  'Correas': [
    { slug: 'arnes-o-collar-perros-guia', titulo: 'Arnés o collar: qué elegir para el paseo' },
    { slug: 'perro-tira-de-la-correa-soluciones', titulo: 'Si tu perro tira de la correa: soluciones' },
    { slug: 'mejores-correas-largas-perros-adiestramiento', titulo: 'Mejores correas largas para perros' },
  ],
};

export function blogsForCategory(categoria?: string | null): { slug: string; titulo: string }[] {
  if (!categoria) return [];
  return PRODUCT_CATEGORY_TO_BLOGS[categoria] ?? [];
}

// Seccions amb guies pròpies dins d'una categoria barrejada: «Alimentación específica»
// té pinsos renals i digestius, i cada fitxa ha d'enllaçar les guies del seu problema.
const SECCIONES_CON_GUIAS_PROPIAS = ['Digestión sensible', 'Problemas renales y urinarios'];

export function blogsForProduct(categoria?: string | null, secciones?: string[]): { slug: string; titulo: string }[] {
  const seccion = secciones?.find((s) => SECCIONES_CON_GUIAS_PROPIAS.includes(s));
  return blogsForCategory(seccion ?? categoria);
}

export function categoryForBlog(slug: string): string | null {
  return BLOG_TO_PRODUCT_CATEGORY[slug] ?? null;
}

export const RELATED_PRODUCTS_LIMIT = 4;

export type BlogProductSource = {
  data: {
    slug?: string;
    nombre: string;
    nombreCorto?: string;
    imagen?: string;
    precio?: string;
    precioOriginal?: string;
    descuentoPct?: number;
    marca?: string;
    valoracion?: number;
    valoracionesCount?: number;
    categoria?: string;
    disponible?: boolean;
  };
};

// Només es recomana el que ara es pot comprar amb preu (scripts/update_prices.py treu
// el preu als no disponibles i als que no tenen oferta de nou a Amazon).
const recomendable = (articulo: BlogProductSource) =>
  articulo.data.disponible !== false && Boolean(articulo.data.precio);

export type RelatedBlogProduct = {
  slug: string;
  nombre: string;
  imagen?: string;
  precio?: string;
  precioOriginal?: string;
  descuentoPct?: number;
  marca?: string;
  valoracion?: number;
  valoracionesCount?: number;
};

export type BlogPostForProducts = {
  slug: string;
  data: {
    productosRecomendados?: string[];
    productosExcluidos?: string[];
  };
};

export function articuloProductSlug(articulo: BlogProductSource): string {
  return articulo.data.slug || slugify(articulo.data.nombre);
}

function toRelatedProduct(articulo: BlogProductSource): RelatedBlogProduct {
  return {
    slug: articuloProductSlug(articulo),
    nombre: articulo.data.nombreCorto || articulo.data.nombre,
    imagen: articulo.data.imagen,
    precio: articulo.data.precio,
    precioOriginal: articulo.data.precioOriginal,
    descuentoPct: articulo.data.descuentoPct,
    marca: articulo.data.marca,
    valoracion: articulo.data.valoracion,
    valoracionesCount: articulo.data.valoracionesCount,
  };
}

/**
 * Productes del bloc «Nuestra selección» d'un post.
 * `productosRecomendados` té prioritat sobre el mapeig per categoria;
 * `productosExcluidos` s'aplica en els dos camins.
 */
export function relatedProductsForBlog(
  post: BlogPostForProducts,
  articulos: BlogProductSource[],
  limit = RELATED_PRODUCTS_LIMIT,
): RelatedBlogProduct[] {
  const excluded = new Set(post.data.productosExcluidos ?? []);
  const recommended = (post.data.productosRecomendados ?? []).filter(Boolean);
  const bySlug = new Map<string, BlogProductSource>();
  for (const articulo of articulos) {
    bySlug.set(articuloProductSlug(articulo), articulo);
  }

  if (recommended.length > 0) {
    return recommended
      .filter((slug) => !excluded.has(slug))
      .map((slug) => bySlug.get(slug))
      .filter((articulo): articulo is BlogProductSource => Boolean(articulo) && recomendable(articulo))
      .slice(0, limit)
      .map(toRelatedProduct);
  }

  const productCat = categoryForBlog(post.slug);
  if (!productCat) return [];

  return articulos
    .filter((articulo) => {
      const slug = articuloProductSlug(articulo);
      return articulo.data.categoria === productCat && !excluded.has(slug) && recomendable(articulo);
    })
    .sort((a, b) => {
      const rating = (b.data.valoracion ?? 0) - (a.data.valoracion ?? 0);
      if (rating !== 0) return rating;
      return articuloProductSlug(a).localeCompare(articuloProductSlug(b));
    })
    .slice(0, limit)
    .map(toRelatedProduct);
}

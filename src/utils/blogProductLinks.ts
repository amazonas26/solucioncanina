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
  'mejores-camas-ortopedicas-perros': 'Camas ortopédicas',
  'rampas-para-perros-beneficios': 'Rampas',
  'pienso-renal-perros-guia': 'Alimentación específica',
  'pienso-bajo-sodio-perros-renal': 'Alimentación específica',
  'aceite-salmon-perros-beneficios': 'Alimentación específica',
  'ansiedad-ruidos-perros-calmar-estres': 'Ansiedad',
  'ansiedad-separacion-perros-guia': 'Ansiedad',
  'miedo-petardos-perros-soluciones': 'Ansiedad',
  'relajantes-naturales-perros-gotas-feromonas-chaleco': 'Ansiedad',
  'perro-tira-de-la-correa-soluciones': 'Correas',
  'arnes-o-collar-perros-guia': 'Correas',
  'mejores-correas-largas-perros-adiestramiento': 'Correas',
  'bozales-perros-guia-elegir-talla': 'Bozales',
  'camas-ortopedicas-perros-artrosis-displasia': 'Camas ortopédicas',
  'displasia-cadera-perros-sintomas-cuidados': 'Camas ortopédicas',
};

export const PRODUCT_CATEGORY_TO_BLOGS: Record<string, { slug: string; titulo: string }[]> = {
  'Condroprotectores': [
    { slug: 'condroprotectores-perros-guia-completa', titulo: 'Condroprotectores para perros: guía completa' },
    { slug: 'glucosamina-para-perros-para-que-sirve-dosis', titulo: 'Glucosamina para perros: para qué sirve y dosis' },
    { slug: 'mejor-condroprotector-perros-artrosis', titulo: 'El mejor condroprotector para perros con artrosis' },
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
    { slug: 'pastillas-perros-artrosis-comprimidos-gotas-snacks', titulo: 'Pastillas para perros con artrosis: comprimidos, gotas o snacks' },
    { slug: 'pienso-con-condroprotectores-o-suplemento', titulo: '¿Basta un pienso con condroprotectores?' },
  ],
  'Camas ortopédicas': [
    { slug: 'mejores-camas-ortopedicas-perros', titulo: 'Mejores camas ortopédicas para perros' },
    { slug: 'camas-ortopedicas-perros-artrosis-displasia', titulo: 'Camas ortopédicas para perros con artrosis o displasia' },
    { slug: 'displasia-cadera-perros-sintomas-cuidados', titulo: 'Displasia de cadera en perros: síntomas y cuidados' },
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
  ],
  'Bozales': [
    { slug: 'bozales-perros-guia-elegir-talla', titulo: 'Bozales para perros: guía para elegir talla y tipo' },
  ],
  'Rampas': [
    { slug: 'rampas-para-perros-beneficios', titulo: 'Rampas para perros: cuándo y por qué usarlas' },
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
  ],
  'Movilidad y artrosis': [
    { slug: 'como-mejorar-movilidad-perro-mayor', titulo: 'Cómo mejorar la movilidad de un perro mayor' },
    { slug: 'pastillas-perros-artrosis-comprimidos-gotas-snacks', titulo: 'Pastillas para perros con artrosis: comprimidos, gotas o snacks' },
    { slug: 'pienso-con-condroprotectores-o-suplemento', titulo: '¿Basta un pienso con condroprotectores?' },
    { slug: 'condroprotectores-perros-guia-completa', titulo: 'Condroprotectores para perros: guía completa' },
    { slug: 'camas-ortopedicas-perros-artrosis-displasia', titulo: 'Camas ortopédicas para perros con artrosis o displasia' },
    { slug: 'rampas-para-perros-beneficios', titulo: 'Rampas para perros: cuándo y por qué usarlas' },
  ],
  'Alimentación específica': [
    { slug: 'pienso-renal-perros-guia', titulo: 'Pienso renal para perros: guía' },
    { slug: 'pienso-bajo-sodio-perros-renal', titulo: 'Pienso bajo en sodio (y fósforo) para problema renal' },
    { slug: 'aceite-salmon-perros-beneficios', titulo: 'Beneficios del aceite de salmón para perros' },
  ],
  'Ansiedad': [
    { slug: 'ansiedad-ruidos-perros-calmar-estres', titulo: 'Calmar la ansiedad por ruidos en perros' },
    { slug: 'ansiedad-separacion-perros-guia', titulo: 'Ansiedad por separación: guía para perros' },
    { slug: 'miedo-petardos-perros-soluciones', titulo: 'Miedo a los petardos: soluciones' },
    { slug: 'relajantes-naturales-perros-gotas-feromonas-chaleco', titulo: 'Relajantes naturales: gotas, feromonas y chaleco' },
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
    marca?: string;
    valoracion?: number;
    categoria?: string;
  };
};

export type RelatedBlogProduct = {
  slug: string;
  nombre: string;
  imagen?: string;
  precio?: string;
  marca?: string;
  valoracion?: number;
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
    marca: articulo.data.marca,
    valoracion: articulo.data.valoracion,
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
      .filter((articulo): articulo is BlogProductSource => Boolean(articulo))
      .slice(0, limit)
      .map(toRelatedProduct);
  }

  const productCat = categoryForBlog(post.slug);
  if (!productCat) return [];

  return articulos
    .filter((articulo) => {
      const slug = articuloProductSlug(articulo);
      return articulo.data.categoria === productCat && !excluded.has(slug);
    })
    .sort((a, b) => {
      const rating = (b.data.valoracion ?? 0) - (a.data.valoracion ?? 0);
      if (rating !== 0) return rating;
      return articuloProductSlug(a).localeCompare(articuloProductSlug(b));
    })
    .slice(0, limit)
    .map(toRelatedProduct);
}

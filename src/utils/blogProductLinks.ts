// Mapeig topicalmnent un blog post i una categoria de producte.
// S'usa per generar enllaços interns blog → producte i producte → blog,
// que ajuden el PageRank intern i la conversió.

export const BLOG_TO_PRODUCT_CATEGORY: Record<string, string> = {
  'mejor-condroprotector-perros-artrosis': 'Condroprotectores',
  'condroprotectores-perros-guia-completa': 'Condroprotectores',
  'mejores-camas-ortopedicas-perros': 'Camas ortopédicas',
  'rampas-para-perros-beneficios': 'Rampas',
  'pienso-renal-perros-guia': 'Alimentación específica',
  'aceite-salmon-perros-beneficios': 'Alimentación específica',
  'ansiedad-ruidos-perros-calmar-estres': 'Ansiedad',
  'ansiedad-separacion-perros-guia': 'Ansiedad',
  'miedo-petardos-perros-soluciones': 'Ansiedad',
  'perro-tira-de-la-correa-soluciones': 'Correas',
  'bozales-perros-guia-elegir-talla': 'Bozales',
  'camas-ortopedicas-perros-artrosis-displasia': 'Camas ortopédicas',
};

export const PRODUCT_CATEGORY_TO_BLOGS: Record<string, { slug: string; titulo: string }[]> = {
  'Condroprotectores': [
    { slug: 'condroprotectores-perros-guia-completa', titulo: 'Condroprotectores para perros: guía completa' },
    { slug: 'mejor-condroprotector-perros-artrosis', titulo: 'El mejor condroprotector para perros con artrosis' },
  ],
  'Camas ortopédicas': [
    { slug: 'mejores-camas-ortopedicas-perros', titulo: 'Mejores camas ortopédicas para perros' },
    { slug: 'camas-ortopedicas-perros-artrosis-displasia', titulo: 'Camas ortopédicas para perros con artrosis o displasia' },
  ],
  'Bozales': [
    { slug: 'bozales-perros-guia-elegir-talla', titulo: 'Bozales para perros: guía para elegir talla y tipo' },
  ],
  'Rampas': [
    { slug: 'rampas-para-perros-beneficios', titulo: 'Rampas para perros: cuándo y por qué usarlas' },
  ],
  'Alimentación específica': [
    { slug: 'pienso-renal-perros-guia', titulo: 'Pienso renal para perros: guía' },
    { slug: 'aceite-salmon-perros-beneficios', titulo: 'Beneficios del aceite de salmón para perros' },
  ],
  'Ansiedad': [
    { slug: 'ansiedad-ruidos-perros-calmar-estres', titulo: 'Calmar la ansiedad por ruidos en perros' },
    { slug: 'ansiedad-separacion-perros-guia', titulo: 'Ansiedad por separación: guía para perros' },
    { slug: 'miedo-petardos-perros-soluciones', titulo: 'Miedo a los petardos: soluciones' },
  ],
  'Correas': [
    { slug: 'perro-tira-de-la-correa-soluciones', titulo: 'Si tu perro tira de la correa: soluciones' },
  ],
};

export function blogsForCategory(categoria?: string | null): { slug: string; titulo: string }[] {
  if (!categoria) return [];
  return PRODUCT_CATEGORY_TO_BLOGS[categoria] ?? [];
}

export function categoryForBlog(slug: string): string | null {
  return BLOG_TO_PRODUCT_CATEGORY[slug] ?? null;
}

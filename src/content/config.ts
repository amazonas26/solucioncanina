import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const articulosCollection = defineCollection({
  loader: glob({ pattern: '**/index.json', base: './src/content/articulos' }),
  schema: z.object({
    nombre: z.string(),
    // Nom humà per a H1 i <title>: marca + tipus + tret distintiu + talla/mesura.
    // `nombre` es queda com el títol literal d'Amazon (sovint 100–180 car.).
    nombreCorto: z.string().min(1).max(60),
    slug: z.string().optional(),
    // Títol/descripció per al <title> i <meta description> de Google. Si no s'omplen,
    // el títol de fitxa és `{nombreCorto} · análisis y precio`.
    tituloSeo: z.string().optional(),
    descripcionSeo: z.string().optional(),
    descripcion: z.string().optional(),
    imagen: z.string().optional(),
    precio: z.string().optional(),
    precioOriginal: z.string().optional(),
    descuentoPct: z.number().int().min(0).max(100).optional(),
    ventas: z.number().int().min(0).optional(),
    valoracion: z.number().min(0).max(5).optional(),
    valoracionesCount: z.number().int().min(0).optional(),
    linkAmazon: z.string().url(),
    categoria: z.string().optional(),
    secciones: z.array(z.string()).optional(),
    seccionPrimaria: z.string().optional(),
    marca: z.string().optional(),
    veredicto: z.string().optional(),
    analisis: z.string().optional(),
    // Cómo se ha elaborado la ficha. Ver /como-analizamos/.
    tipoAnalisis: z
      .enum(['Probado en casa', 'Analizado', 'Pendiente'])
      .default('Analizado'),
    experienciaReal: z.string().optional(),
    pros: z.array(z.string()).optional(),
    contras: z.array(z.string()).optional(),
    paraQuien: z.string().optional(),
  }),
});

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    titulo: z.string(),
    // Títol/descripció específics per al <title> i <meta description> de Google.
    // Si no s'omplen, es fa servir `titulo`/`descripcion`. Permeten un H1 editorial
    // llarg amb un títol-SEO curt (~55-60 car.) optimitzat per keyword i CTR.
    tituloSeo: z.string().optional(),
    descripcionSeo: z.string().optional(),
    descripcion: z.string().optional(),
    imagen: z.string().optional(),
    categoria: z.enum(['comportamiento', 'guias', 'salud', 'alimentacion']).default('guias'),
    autor: z.string().default('Equipo Solución Canina'),
    fechaPublicacion: z.coerce.date().optional(),
    fechaActualizacion: z.coerce.date().optional(),
    // Slugs de `/producto/<slug>/`. Si n'hi ha, substitueixen el mapeig
    // blog → categoria de producte. `productosExcluidos` s'aplica sempre.
    productosRecomendados: z.array(z.string().min(1)).optional(),
    productosExcluidos: z.array(z.string().min(1)).optional(),
    faqs: z.array(z.object({
      pregunta: z.string(),
      respuesta: z.string(),
    })).optional(),
  }),
});

export const collections = {
  articulos: articulosCollection,
  blog: blogCollection,
};

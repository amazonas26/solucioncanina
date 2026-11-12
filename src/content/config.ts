import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { HERRAMIENTA_IDS } from '../utils/herramientas';

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
    // `false` quan Amazon el dona per esgotat o la fitxa ja no existeix
    // (ho posa scripts/update_prices.py, que també en treu el preu).
    disponible: z.boolean().optional(),
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
    // % d'EPA+DHA (en pes) que declara la fitxa d'un oli d'omega-3; l'usa la calculadora d'omega-3.
    epaDhaPct: z.number().min(0).max(100).optional(),
    // Taula de talles d'un bolquer o faixa (cintura en cm, i pes en kg si la marca el dona);
    // l'usa la calculadora de talla de bolquer. `deducida`: la marca no la publica en text.
    tallasPanal: z
      .object({
        sexo: z.enum(['macho', 'hembra']),
        tipo: z.enum(['desechable', 'lavable']),
        tallas: z.array(
          z.object({
            talla: z.string(),
            min: z.number(),
            max: z.number(),
            pesoMin: z.number().optional(),
            pesoMax: z.number().optional(),
            deducida: z.boolean().optional(),
          }),
        ),
      })
      .optional(),
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
    // Calculadores que es mostren al bloc del final, en aquest ordre.
    calculadoras: z.array(z.enum(HERRAMIENTA_IDS)).optional(),
    faqs: z.array(z.object({
      pregunta: z.string(),
      respuesta: z.string(),
    })).optional(),
    // Ids de src/data/fuentes.json (estudis amb DOI verificat a Crossref i webs
    // d'organismes). Es mostren al final de l'article; un id inexistent fa fallar el build.
    fuentes: z.array(z.string().min(1)).optional(),
  }),
});

export const collections = {
  articulos: articulosCollection,
  blog: blogCollection,
};

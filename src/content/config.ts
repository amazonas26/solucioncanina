import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const articulosCollection = defineCollection({
  loader: glob({ pattern: '**/index.json', base: './src/content/articulos' }),
  schema: z.object({
    nombre: z.string(),
    slug: z.string().optional(),
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
    descripcion: z.string().optional(),
    imagen: z.string().optional(),
    categoria: z.enum(['comportamiento', 'guias', 'salud', 'alimentacion']).default('guias'),
    autor: z.string().default('Equipo Solución Canina'),
    fechaPublicacion: z.coerce.date().optional(),
    fechaActualizacion: z.coerce.date().optional(),
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

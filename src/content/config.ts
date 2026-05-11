import { z, defineCollection } from 'astro:content';

const articulosCollection = defineCollection({
  type: 'data',
  schema: z.object({
    nombre: z.string(),
    descripcion: z.string().optional(),
    imagen: z.string().optional(),
    precio: z.string().optional(),
    precioOriginal: z.string().optional(),
    descuentoPct: z.number().int().min(0).max(100).optional(),
    ventas: z.number().int().min(0).optional(),
    linkAmazon: z.string().url(),
    categoria: z.string().optional(),
    marca: z.string().optional(),
  }),
});

export const collections = {
  articulos: articulosCollection,
};

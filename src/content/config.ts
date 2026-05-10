import { z, defineCollection } from 'astro:content';

const articulosCollection = defineCollection({
  type: 'data',
  schema: z.object({
    nombre: z.string(),
    descripcion: z.string().optional(),
    imagen: z.string().optional(),
    precio: z.string().optional(),
    linkAmazon: z.string().url(),
    categoria: z.string().optional(),
    marca: z.string().optional(),
  }),
});

export const collections = {
  articulos: articulosCollection,
};

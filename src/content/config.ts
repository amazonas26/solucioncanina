import { z, defineCollection } from 'astro:content';

const productsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    amazonLink: z.string().url(),
    image: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = {
  products: productsCollection,
};

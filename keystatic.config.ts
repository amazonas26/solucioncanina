import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    products: collection({
      label: 'Products',
      slugField: 'name',
      path: 'src/content/products/*/',
      format: { data: 'json' },
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        amazonLink: fields.url({
          label: 'Amazon Link',
          description: 'The URL to the Amazon product page',
          validation: { isRequired: true },
        }),
        image: fields.image({
          label: 'Product Image',
          directory: 'public/images/products',
          publicPath: '/images/products',
        }),
        description: fields.text({
          label: 'Short Description',
          multiline: true,
        }),
      },
    }),
  },
});

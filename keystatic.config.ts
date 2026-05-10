import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    articulos: collection({
      label: 'Artículos',
      slugField: 'nombre',
      path: 'src/content/articulos/*/',
      format: { data: 'json' },
      schema: {
        nombre: fields.slug({ name: { label: 'Nombre' } }),
        descripcion: fields.text({
          label: 'Descripción',
          multiline: true,
        }),
        imagen: fields.image({
          label: 'Imagen',
          directory: 'public/images/articulos',
          publicPath: '/images/articulos',
        }),
        precio: fields.text({
          label: 'Precio',
          description: 'Ej: 25.99€',
        }),
        linkAmazon: fields.url({
          label: 'Link Amazon',
          description: 'Enlace al producto en Amazon',
          validation: { isRequired: true },
        }),
        categoria: fields.text({
          label: 'Categoría',
          description: 'Ej: Juguetes, Alimentación...',
        }),
        marca: fields.text({
          label: 'Marca',
        }),
      },
    }),
  },
});

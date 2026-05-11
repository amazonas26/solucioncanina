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
        precioOriginal: fields.text({
          label: 'Precio original (tachado)',
          description: 'Ej: 39.99€. Si se rellena, se mostrará tachado junto al precio.',
        }),
        descuentoPct: fields.integer({
          label: 'Descuento (%)',
          description: 'Porcentaje de descuento, 0-100. Se mostrará como badge "-NN%".',
        }),
        ventas: fields.integer({
          label: 'Ventas mensuales',
          description: 'Nº aproximado de compras mensuales (de "Más de X comprados el último mes"). Se usa para ordenar el Top 6 de más vendidos.',
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

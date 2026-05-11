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
        // Nuevos campos editoriales
        veredicto: fields.text({
          label: 'Veredicto Editorial',
          description: 'Resumen potente (2 frases) de por qué destaca.',
          multiline: true,
        }),
        analisis: fields.text({
          label: 'Análisis en profundidad',
          description: 'Explicación detallada de los beneficios (2-3 párrafos).',
          multiline: true,
        }),
        pros: fields.array(
          fields.text({ label: 'Pro' }),
          {
            label: 'Pros',
            itemLabel: props => props.value || 'Nuevo pro',
          }
        ),
        contras: fields.array(
          fields.text({ label: 'Contra' }),
          {
            label: 'Contras',
            itemLabel: props => props.value || 'Nuevo contra',
          }
        ),
        paraQuien: fields.text({
          label: '¿Para quién es?',
          description: 'Define el tipo de perro o dueño ideal para este producto.',
          multiline: true,
        }),
      },
    }),
    blog: collection({
      label: 'Artículos de Blog',
      slugField: 'titulo',
      path: 'src/content/blog/*/',
      format: { contentField: 'contenido' },
      schema: {
        titulo: fields.slug({ name: { label: 'Título' } }),
        descripcion: fields.text({
          label: 'Descripción breve',
          multiline: true,
        }),
        imagen: fields.image({
          label: 'Imagen de portada',
          directory: 'public/images/blog',
          publicPath: '/images/blog',
        }),
        categoria: fields.select({
          label: 'Categoría',
          options: [
            { label: 'Problemas de comportamiento', value: 'comportamiento' },
            { label: 'Guías de Compra Directa', value: 'guias' },
            { label: 'Salud e Higiene', value: 'salud' },
            { label: 'Alimentación y Curiosidades', value: 'alimentacion' },
          ],
          defaultValue: 'guias',
        }),
        contenido: fields.mdx({
          label: 'Contenido del artículo',
          options: {
            image: {
              directory: 'public/images/blog',
              publicPath: '/images/blog',
            },
          },
        }),
      },
    }),
  },
});

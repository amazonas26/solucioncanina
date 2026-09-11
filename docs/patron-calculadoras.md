# Patrón de calculadoras (referencia: condroprotector)

Documento de referencia para replicar calculadoras nuevas siguiendo la implementación existente de dosis de condroprotector. No describe dominio clínico; describe **estructura de código, SEO, catálogo e inbound links**.

Referencia viva:

| Pieza | Ruta |
| --- | --- |
| Componente React | `src/components/CondroprotectorCalculator.tsx` |
| Página Astro | `src/pages/calculadora-dosis-condroprotector-perros.astro` |
| Helpers JSON-LD | `src/utils/seo.ts` (`breadcrumbSchema`, `faqPageSchema`) |
| Banner en categoría | `src/pages/categoria/[slug].astro` (bloque `categorySlug === 'condroprotectores'`) |
| Redirect legacy | `vercel.json` → `/categoria/condroprotectores/calculadora-dosis` |

URL canónica de ejemplo: `/calculadora-dosis-condroprotector-perros/` (Astro + trailing slash del sitio).

---

## 1. Visión general del patrón

Cada calculadora es un **activo linkable** de una sola página:

1. **Página Astro estática** en `src/pages/<slug-calculadora>.astro` (ruta top-level, no bajo `/categoria/`).
2. **Isla React** hidratada con `client:load`, que recibe props ya resueltas en el frontmatter Astro (productos del catálogo, no fetch en cliente).
3. **Contenido SEO estático** debajo de la isla: explicación, tabla/rangos, FAQs visibles + disclaimer.
4. **JSON-LD** `BreadcrumbList` + `FAQPage` inyectados vía `Layout` → `SEO.astro`.
5. **Enlaces de salida** a fichas `/producto/<slug>/` y a la categoría del tema.
6. **Enlaces de entrada** desde la página de categoría (banner) y posts del blog relacionados.

El objetivo de negocio/SEO: herramienta útil que atrae enlaces y convierte a fichas de producto / categoría.

---

## 2. Estructura del componente React

### 2.1 Responsabilidad

El componente es **presentación + lógica de cálculo en cliente**. No lee colecciones Astro, no genera JSON-LD, no conoce Layout.

Firma de referencia:

```ts
export interface CalcProducto {
  slug: string;
  titulo: string;
  marca: string;
  precio: string;
  valoracion: number;
  imagen?: string; // se pasa desde Astro; hoy no se renderiza en la UI
}

interface Props {
  productos: CalcProducto[];
}
```

### 2.2 Capas internas (orden en el JSX)

1. **Cabecera** — gradiente `primary`, icono Lucide (`Calculator`), título `h2`.
2. **Controles** (columna izq. en `md:grid-cols-2`) — inputs de estado (`useState`).
3. **Resultado** (columna dcha.) — valores derivados (`useMemo` sobre inputs).
4. **Bloque productos** — top N del array recibido + CTA a categoría.

### 2.3 Estado y dominio (plantilla mental)

En la referencia:

| Estado | Tipo | Rol |
| --- | --- | --- |
| `peso` | `number` | input principal (slider + number) |
| `etapa` | unión de strings | contexto editorial (solo cambia la nota, no la fórmula) |
| `carga` | `boolean` | modifica la fórmula (factor ×2 en gluco/condro) |

Patrón a copiar:

- Constantes de dominio **junto al componente** (p. ej. `ETAPAS`, función `getDose`).
- Formateo localizado (`toLocaleString('es-ES')`).
- Accesibilidad básica: `label`/`htmlFor`, `aria-pressed` en toggles, `aria-describedby` en el peso.
- Estilos con utilidades Tailwind del design system (`primary-*`, `neutral-*`, `rounded-2xl`, bordes suaves).
- Iconos de `lucide-react`.

### 2.4 Bloque de productos recomendados

```text
productos (ya filtrados y ordenados en Astro)
  → slice(0, 4)
  → cada ítem: <a href={`/producto/${slug}/`}> marca + "condroprotector" + ★ + precio
  → CTA final: <a href="/categoria/condroprotectores/">Ver todos…
```

Notas:

- El orden y el filtro **no** se hacen en React: llegan preparados.
- El copy del enlace usa `marca` + etiqueta de categoría genérica (“condroprotector”), no necesariamente `titulo` completo (evita títulos Amazon kilométricos).
- Si `productos` está vacío, el bloque no se renderiza (`recomendados.length > 0`).

### 2.5 Qué no poner en el componente

- FAQs, breadcrumbs, meta title/description.
- Texto largo de “cómo se calcula” / fuentes.
- Disclaimer legal (va en la página Astro).
- Llamadas a Amazon o a la colección `articulos`.

---

## 3. Integración en la página Astro

### 3.1 Frontmatter: datos

```text
getCollection('articulos')
  → filtrar por data.categoria === '<Categoría exacta del JSON>'
  → map a CalcProducto { slug, titulo, marca, precio, valoracion, imagen }
  → excluir slugs no pertinentes (lista EXCLUIR local)
  → sort por valoracion desc
```

También se derivan `categories` (Set de categorías del catálogo) para el header vía `Layout`.

`slug` del producto: `a.data.slug || slugify(a.data.nombre)` (mismo criterio que el resto del site).

### 3.2 Frontmatter: FAQs y SEO schemas

Array local `faqs: { pregunta, respuesta }[]` (mismo contenido que se pinta en HTML).

```ts
const pageUrl = '/calculadora-…'; // sin trailing slash en el helper; absUrl lo normaliza
const breadcrumbJsonLd = breadcrumbSchema([
  { name: 'Inicio', url: '/' },
  { name: '<Nombre corto>', url: pageUrl },
]);
const faqJsonLd = faqPageSchema(faqs);
```

### 3.3 Layout y meta

```astro
<Layout
  title="… (incluye keyword + 'para perros' / por peso)"
  description="…"
  categories={categories}
  jsonLd={[breadcrumbJsonLd, faqJsonLd]}
>
```

`Layout` fusiona estos schemas con `organizationSchema` + `websiteSchema` globales y los pasa a `SEO.astro`, que emite un `<script type="application/ld+json">` por objeto.

### 3.4 Cuerpo de página (orden)

1. Breadcrumb visual HTML (`nav aria-label="Breadcrumb"`): Inicio → nombre corto.
2. `h1` + lead (1 párrafo; keyword en el H1).
3. Isla: `<XxxCalculator client:load productos={productos} />`.
4. Sección editorial `prose`:
   - H2 “Cómo se calcula…”
   - Tabla/rangos o explicación
   - Enlaces internos a **guía de blog** y **categoría**
   - Fuentes (texto pequeño)
   - H2 “Preguntas frecuentes” + map de `faqs` (mismas que el schema)
   - Disclaimer veterinario / orientativo

### 3.5 Hydration

Usar `client:load` (igual que `SearchableGrid` / asistente): la calculadora es el contenido principal de la página y debe ser interactiva al cargar.

Nombre de archivo de página = slug de URL. Ejemplo: `calculadora-dosis-condroprotector-perros.astro` → `/calculadora-dosis-condroprotector-perros/`.

---

## 4. JSON-LD: FAQPage y BreadcrumbList

Helpers en `src/utils/seo.ts`.

### 4.1 BreadcrumbList

`breadcrumbSchema(items: { name, url }[])` genera:

- `@type: BreadcrumbList`
- `itemListElement[]` con `ListItem`, `position` 1-based, `item: absUrl(url)`

En calculadoras el trail es **plano** (Inicio → Calculadora). No inserta la categoría intermedia en el JSON-LD (aunque el banner vive en la categoría).

### 4.2 FAQPage

`faqPageSchema(faqs)` genera:

- `@type: FAQPage`
- `mainEntity[]` → `Question` + `acceptedAnswer.Answer`
- Campos: `pregunta` → `name`, `respuesta` → `text`

**Regla:** el array `faqs` del frontmatter alimenta **a la vez** el HTML visible y el JSON-LD. No duplicar textos en sitios distintos.

### 4.3 Pipeline de emisión

```text
página.astro  →  Layout jsonLd={[...]}  →  SEO.astro  →  <script type="application/ld+json">
```

No hace falta tocar `SEO.astro` ni `Layout` al añadir una calculadora nueva.

---

## 5. Enlace a productos del catálogo

### 5.1 Origen de datos

Colección content `articulos` (`src/content/articulos/*/index.json`). Campos usados:

| Campo JSON | Uso en calculadora |
| --- | --- |
| `categoria` | Filtro (string exacto, p. ej. `"Condroprotectores"`) |
| `slug` / `nombre` | URL `/producto/{slug}/` |
| `tituloSeo` / `nombre` | `titulo` (prop; hoy poco usado en UI) |
| `marca` | Texto del enlace |
| `precio` | Subtítulo |
| `valoracion` | Orden + estrellas |
| `imagen` | Prop opcional (reservada; UI actual no la muestra) |

### 5.2 Filtros locales

Lista `EXCLUIR` de slugs mal categorizados o fuera de tema (en la referencia: multivitamínico y probiótico etiquetados como Condroprotectores).

### 5.3 URLs de salida desde el componente

- Ficha: `/producto/${slug}/`
- Hub: `/categoria/<slug-categoria>/` (slugify de la categoría; en referencia `condroprotectores`)

La página Astro también enlaza editorialmente a la misma categoría y a 1+ posts del blog del tema.

---

## 6. Desde dónde se enlaza (inbound)

### 6.1 Categoría (banner dedicado)

En `src/pages/categoria/[slug].astro`, bloque condicional:

```astro
{categorySlug === 'condroprotectores' && (
  <section id="banner-calculadora">…</section>
)}
```

Patrón UI: tarjeta horizontal con icono, eyebrow “Herramienta gratis”, H2, microcopy, CTA “Abrir calculadora”. Colocado **después** de la guía de categoría y **antes** del grid de productos.

Para una calculadora nueva: otro `categorySlug === '…'` (o refactor a mapa categoría → calculadora si crecen).

### 6.2 Posts del blog

Enlaces contextuales en MDX (anchor con keyword natural). Referencia actual:

| Post | Contexto del enlace |
| --- | --- |
| `condroprotectores-perros-guia-completa` | Tras tabla de dosis / coste por dosis activa |
| `glucosamina-para-perros-para-que-sirve-dosis` | Tras tabla por peso + mención en checklist final |
| `displasia-cadera-perros-sintomas-cuidados` | En sección de condroprotectores como cuidado |

URL usada: `/calculadora-dosis-condroprotector-perros/`.

Al crear calculadoras nuevas: enlazar desde **guía pilar** del tema + 1–2 posts satélite relacionados.

### 6.3 Redirect opcional

En `vercel.json`, redirect permanente desde una URL “bajo categoría” hacia la página top-level:

```json
{
  "source": "/categoria/condroprotectores/calculadora-dosis",
  "destination": "/calculadora-dosis-condroprotector-perros/",
  "permanent": true
}
```

Útil si se promociona una URL anidada o se cambia de sitio el recurso. No es obligatorio para el patrón mínimo.

### 6.4 Lo que no enlaza hoy

- Home / listados globales de herramientas (no hay índice de calculadoras).
- Fichas de producto individuales (no hay CTA calculadora en `/producto/[slug]`).
- Sitemap dedicado (la página entra por ser archivo en `src/pages/`).

---

## 7. Checklist para crear una calculadora nueva

Copiar este orden:

1. **Definir slug URL** top-level (`calculadora-<tema>-perros` o similar) y título/meta.
2. **Crear** `src/components/<Nombre>Calculator.tsx`:
   - Props `productos: CalcProducto[]` (reutilizar la interface o exportarla a un tipo compartido si hay varias).
   - Controles + resultado + bloque top-4 + CTA categoría.
3. **Crear** `src/pages/<slug>.astro`:
   - Filtrar `articulos` por categoría (y `EXCLUIR` si hace falta).
   - Array `faqs` (≥3–5).
   - `breadcrumbSchema` + `faqPageSchema`.
   - `Layout` + breadcrumb HTML + H1 + `<Calculator client:load … />` + prose + FAQs + disclaimer.
4. **Inbound categoría:** banner en `categoria/[slug].astro` cuando `categorySlug` coincida.
5. **Inbound blog:** enlaces en guía pilar + posts relacionados.
6. **Opcional:** redirect en `vercel.json` si quieres una URL bajo `/categoria/…`.
7. **Verificar:** build Astro, que los JSON-LD salen en el HTML, que los `/producto/…` resuelven, y que el filtro de categoría no arrastra productos ajenos.

### 7.1 Piezas reutilizables vs específicas

| Reutilizable tal cual | Específico por calculadora |
| --- | --- |
| `breadcrumbSchema` / `faqPageSchema` | Fórmula / inputs / copy UI |
| Pipeline `Layout` → `SEO` | Filtro de `articulos` + `EXCLUIR` |
| Forma de `CalcProducto` | FAQs y prosa |
| Patrón banner categoría | Condición `categorySlug` y textos |
| `client:load` | Slug de página y CTAs de categoría/blog |

### 7.2 Convención de nombres sugerida

```text
src/components/<Tema>Calculator.tsx
src/pages/calculadora-<tema-kebab>-perros.astro
URL: /calculadora-<tema-kebab>-perros/
Categoría hub: /categoria/<slug-categoria>/
```

---

## 8. Diagrama de dependencias

```text
                    ┌─────────────────────────────┐
                    │  Blog MDX (enlaces inline)  │
                    └──────────────┬──────────────┘
                                   │
┌──────────────────┐   href    ┌───▼──────────────────────────────┐
│ categoria/[slug] │──────────►│ pages/calculadora-….astro         │
│  banner          │           │  · getCollection(articulos)       │
└──────────────────┘           │  · faqs → faqPageSchema           │
                               │  · breadcrumbSchema               │
                               │  · Layout(jsonLd)                 │
                               │  · <XxxCalculator client:load />  │
                               └───────────┬──────────────────────┘
                                           │ props productos
                               ┌───────────▼──────────┐
                               │ XxxCalculator.tsx    │
                               │  · estado / fórmula  │
                               │  · links /producto/  │
                               │  · link /categoria/  │
                               └──────────────────────┘
```

Con este documento debería bastar para clonar el patrón tres veces cambiando dominio (fórmula, categoría, FAQs e inbound), sin reinventar SEO ni la integración Astro↔React.

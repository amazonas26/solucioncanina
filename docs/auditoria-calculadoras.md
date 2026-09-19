# Auditoría de calculadoras

Fecha: 19 de septiembre de 2026.  
Tres calculadoras nuevas se publicaron el **11 de septiembre de 2026** (`432626d7`). La de condroprotector existe desde el 29 de junio. Snapshot GSC: 10–16 sep (semana “a los ~7 días”) y 18 ago–16 sep (30 días).

| Calculadora | Semana 10–16 sep | Posición | 30 días | En sitemap con 0 impr. (huérfana GSC) |
|---|---|---:|---|---|
| Dosis de condroprotector | 83 impr., 5 clics | 4,1 | 319 impr., 26 clics, pos 3,9 | no |
| Talla de bozal | 33 impr., 4 clics | **6,2** | 33 / 4 (todo en esa semana) | no |
| Medida de rampa | 16 impr., 3 clics | 17,3 | 16 / 3 | no |
| Talla de cama ortopédica | **0 / 0** | — | **0 / 0** | **sí** |

Las cifras que citas (bozal 23 impr. pos 6,1; rampa 11; cama 0) son el mismo patrón con otro corte de días. El snapshot local ya muestra a bozal por delante y a cama en cero.

GSC no desglosa bien las queries de las nuevas: de 33 impresiones de bozal solo aparece nombrada *«medidas de bozal para perros»* (1 impr., pos 5). El resto son queries ocultas (umbral de privacidad). De cama no hay ni queries ocultas: **cero filas**. Eso es compatible tanto con “no indexada” como con “indexada y sin ninguna query”. Sin Inspección de URL no se distingue.

---

## Comparativa de las cuatro

Criterios pedidos. El chrome (Layout: Organization + WebSite JSON-LD, header, footer, `OtrasHerramientas`) es **idéntico** en las cuatro.

### Contenido único de la página

Texto visible de la plantilla Astro (H1, lead, tablas, FAQs, disclaimer), sin el chrome ni la isla React. Las “quoted strings” incluyen FAQs + copy del frontmatter.

| | Condro | Bozal | Rampa | Cama |
|---|---:|---:|---:|---:|
| Palabras visibles (aprox.) | 294 | **254** | 220 | **179** |
| Palabras en strings de página (FAQs + copy) | 729 | 507 | 466 | 462 |
| FAQs | 5 | 5 | 5 | 5 |
| Tabla de apoyo | rangos mg/kg + ejemplos 10/30 kg | **6 tallas (perímetro + longitud)** | 3 ángulos × altura | postura (ancho) + grosor por peso |
| Pieza que Amazon no tiene | dosis por kg | talla por hocico | pendiente segura | largo+30 cm / grosor |

La de cama es la **más corta** y la que menos “tabla-respuesta” ofrece. Bozal publica una correspondencia talla↔cm que la gente busca copiar; cama publica fórmulas (`máx(40, 0,55×L)`) más difíciles de matchear a una query.

### Enlaces internos entrantes (número y calidad)

Todas tienen el mismo esqueleto de enlaces de sitio:

| Origen | Condro | Bozal | Rampa | Cama | Calidad |
|---|---:|---:|---:|---:|---|
| Home (`#herramientas`, profundidad 1) | 1 | 1 | 1 | 1 | Alta y **igual** |
| `/herramientas/` | 1 | 1 | 1 | 1 | Media (el hub tuvo 1 impr. en 30 d) |
| Banner en la categoría de producto | 1 | 1 | 1 | 1 | Ver matiz abajo |
| `OtrasHerramientas` (las otras 3 calcs) | 3 | 3 | 3 | 3 | Baja (páginas hermanas nuevas) |
| Redirect legacy `/categoria/…/calculadora-…` | 1 | 1 | 1 | 1 | Irrelevante para Google |
| Posts de blog que enlazan | **3** (guía, glucosamina, displasia) | **1** (guía talla) | **1** (beneficios) | **2** (mejores camas + artrosis) | **Aquí se rompe la igualdad** |

Calidad del inbound de blog (impresiones del post en 30 d):

| Calculadora | Posts que la enlazan | Impresiones del post |
|---|---|---|
| Condro | `condroprotectores-perros-guia-completa`, `glucosamina-…-dosis`, `displasia-cadera-…` | **1144 + 198 + 66** |
| Bozal | `bozales-perros-guia-elegir-talla` | **478**, pos 6,5 |
| Rampa | `rampas-para-perros-beneficios` | **105**, pos 7,0 |
| Cama | `mejores-camas-ortopedicas-perros`, `camas-ortopedicas-perros-artrosis-displasia` | **0 y 47** |

Cama tiene **más** enlaces de blog que bozal y rampa, pero el pilar comercial (`mejores-camas-ortopedicas-perros`, oct 2025, 1155 palabras) **no imprime**. El único empujón real es el post de artrosis/displasia (47 impr.). Bozal cuelga de una guía que ya está en el top 10 de su query.

Matiz del banner de categoría: el CTA vive en `/categoria/bozales/`, `/categoria/rampas/`, `/categoria/camas-ortopedicas/`, `/categoria/condroprotectores/`. La home **no enlaza esas categorías** (las sustituye por secciones-problema). Las secciones-problema **no llevan el banner**. El footer sí apunta a categorías de producto. Resultado: el banner de cama está en una URL con 8 impresiones; el de bozal, en una URL con 0. El banner no explica la diferencia bozal vs cama.

### Sitemap

Las cuatro pasan el `filter` de `@astrojs/sitemap` (no están en la lista de exclusión: asistente, privacidad, cookies, `/recomienda/`, 404). Están en las 134 URLs del snapshot.

Ninguna calculadora entra en el `lastmodMap` de `astro.config.mjs` (solo JSON de producto, categorías derivadas y MDX de blog). `lastmod` vacío en las cuatro por igual; no explica un 0 vs 33.

Prioridad del sitemap: las calculadoras caen en el `else` (sin `priority`/`changefreq` explícitos). Igual para las cuatro.

### JSON-LD emitido

Cadena común: `Layout` inyecta `organizationSchema` + `websiteSchema`. Cada página añade:

- `BreadcrumbList`: Inicio → Herramientas → {nombre corto}
- `FAQPage`: las mismas 5 preguntas que el HTML

No hay `SoftwareApplication` ni `WebApplication` en ninguna. Cama no omite schema; no hay un JSON-LD que bozal tenga y cama no.

### Título, H1 y meta description

| | `<title>` (SEO.astro añade ` \| Solución Canina`) | H1 | Meta description |
|---|---|---|---|
| Condro | Calculadora de dosis de condroprotector para perros **(por peso)** | Calculadora de dosis de condroprotector para perros | …glucosamina, condroitina y MSM… según su peso. |
| Bozal | Calculadora de talla de bozal para perros **(cesta o silicona)** | Calculadora de talla de bozal para perros | Mide perímetro y longitud del hocico… aviso para jadear y beber. Comparativa de bozales de cesta y silicona. |
| Rampa | Calculadora de medida de rampa para perros **(por altura y peso)** | Calculadora de medida de rampa para perros | …longitud mínima… sofá, cama o maletero… Pendiente segura y capacidad de carga. |
| Cama | Calculadora de talla de cama ortopédica para perros | Calculadora de talla de cama ortopédica para perros | …tamaño mínimo… grosor de espuma según longitud, peso y postura. |

Bozal, rampa y condro meten un **inciso entre paréntesis** en el title (diferenciador de SERP). Cama no: title = H1 = la query genérica “cama ortopédica para perros”, que ya pelean `/categoria/descanso-ortopedico/` (38 impr.), `/categoria/camas-ortopedicas/` (8), el post de artrosis (47) y las fichas Wavve/EHEYCIGA.

La meta de cama no incluye “calculadora” ni “talla” como ancla; habla de “tamaño mínimo” y “grosor”. La de bozal nombra la acción (medir) y el objeto (talla de bozal) dos veces.

### Densidad de la keyword objetivo

Tokens del copy de página + FAQs (aprox.; incluye algo de ruido del frontmatter). Sin normalizar a stopwords.

| Keyword | Condro | Bozal | Rampa | Cama |
|---|---|---|---|---|
| Término ancla | *dosis* 24 (~2,4 %) · *condroprotector* 14 (~1,4 %) | ***bozal* 16 (~2,1 %) · *talla* 17 (~2,2 %)** | *rampa* 15 (~2,2 %) | *cama* 16 (~2,5 %) · *ortopédica* 13 (~2,0 %) |
| Complemento útil | *glucosamina* 12 | *hocico* 8 · *cesta* 10 · *jadear* 6 | *altura* 7 · *pendiente* 4 | *talla* **5 (~0,8 %)** · *espuma* 5 |
| “para perros” | 3 | 3 | 4 | 3 |

Cama está saturada de “cama ortopédica” (la query **comercial** del clúster, ya ocupada) y **floja en “talla”**, que es lo que la haría distinta. Bozal concentra “talla” + “bozal” + “hocico”, que es exactamente *«medidas de bozal para perros»* (pos 5).

### Profundidad de clic desde la home

**1 clic** para las cuatro: grid de herramientas en la home, debajo del hero.

Ruta alternativa común: home → `/herramientas/` → calculadora = **2 clics**. Header “Herramientas” = 2 clics. Footer no enlaza calculadoras sueltas.

No hay diferencia de profundidad. Cama no está más enterrada.

---

## Qué tiene la de bozal que no tenga la de cama

Ordenado por peso, no por “más palabras”.

1. **Un post compañero que ya rankea.** La guía de talla de bozal (478 impr., pos 6,5, publicada 9 jun 2026) enlaza la calculadora con el ancla “calculadora de talla de bozal”. El pilar de camas (`mejores-camas-ortopedicas-perros`, oct 2025) tiene 0 impresiones; no pasa autoridad. Esto solo ya puede explicar 33 vs 0 a los 7 días: Google descubre y asocia la URL nueva desde una página que está sirviendo la query.

2. **Una query informacional 1:1 que Amazon no resuelve.** “Medidas / talla de bozal” es una búsqueda de tabla. “Cama ortopédica para perros” es una búsqueda de producto; la calculadora de cama se presenta con el mismo lenguaje que la categoría y el roundup. Rampa, en cambio, se cuela en queries raras (*dog ramp calculator*, *rampas para perros baratas*) y por eso imprime 16 aunque sea nueva.

3. **Title con diferenciador `(cesta o silicona)`** y meta que nombra perímetro, hocico y talla. Cama duplica el H1 en el title y habla de “tamaño mínimo”, no de “calculadora de talla”.

4. **Más contenido único visible (254 vs 179)** y una tabla de 6 tallas copiable. No es la causa principal (condro tiene más y es más vieja), pero cama es la más delgada de las cuatro.

5. **Densidad de “talla”** 2,2 % vs 0,8 %. Cama optimiza la keyword del clúster comercial, no la de la herramienta.

Lo que **no** diferencia (igual en las dos): profundidad desde home, presencia en sitemap, tipos de JSON-LD, número de FAQs, banner de categoría, bloque “Otras herramientas”, `lastmod` ausente, fecha de publicación.

---

## Lectura conjunta

La de cama no está “rota” a nivel técnico. Está **mal enganchada al clúster que Google ya decidió** (Descanso / post de artrosis / un par de fichas) y **mal nombrada** para una query de herramienta. Bozal nació colgada de una guía en top 10 sobre “cómo medir el hocico”. Rampa, con menos sentido de query en español, aún recogió 16 impresiones por rareza (queries en inglés + “rampas baratas”). Cama compite en un SERP saturado de camas y no se presenta como calculadora.

### Cómo confirmarlo (sin implementar nada aquí)

1. Inspección de URL de `/calculadora-talla-cama-ortopedica-perros/` → si “Descubierta, no indexada” o “Rastreada, no indexada”, el 0 es de índice, no de demanda. Si “Indexada” con 0 queries, es naming + canibalización.
2. Si está no indexada: pedir indexación **después** de que `mejores-camas-ortopedicas-perros` vuelva a tener impresiones, o enlazar la calculadora desde el post que sí mueve (artrosis/displasia ya lo hace; el de condro/displasia no aplica).
3. Dato de demanda: en GSC, comparar volumen de *talla bozal* / *medidas bozal* vs *talla cama ortopédica* / *medida cama perro*. Si la segunda familia no existe, 0 impresiones es el resultado correcto aunque esté indexada.

### Fuera de alcance / ambiguo

- No he tocado titles ni enlaces en este bloque.
- El informe semanal de GSC ya tenía una acción “dar visibilidad a la calculadora de cama”; esta auditoría es el porqué.
- `/herramientas/` casi no existe para Google (1 impr.). No es un hub que arrastre a cama.

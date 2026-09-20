# Diagnóstico de indexación

Fecha del análisis: 19 de septiembre de 2026.  
**Solo lectura del código y de Search Console.** No se ha modificado el catálogo ni las URLs.

## Fuentes y método

- Catálogo: 80 fichas en `src/content/articulos/*/index.json`.
- Plantillas: `src/pages/producto/[slug].astro`, `src/pages/categoria/[slug].astro`, `src/layouts/Layout.astro`, `src/utils/problemSections.ts`.
- Cobertura que citas (77 indexadas / 220 descubiertas; 63 rastreadas no indexadas; 21 descubiertas no rastreadas) es el informe de *cobertura* de GSC. Aquí no hay API de URL Inspection; el proxy es el snapshot de *rendimiento* `scratch/gsc/2026-09-16.json` (propiedad `sc-domain:solucioncanina.es`, 18 ago–16 sep 2026) más el sitemap que el informe semanal descargó (134 URLs).
- Impresiones GSC ≠ “está en el índice”. Una URL puede estar indexada con 0 impresiones. Lo contrario también: impresiones residuales en slugs viejos que ya redirigen. Donde el dato no alcanza, queda marcado como ambiguo.

### Inventario que explica el “220”

El sitemap actual tiene **134 URLs** indexables. Encajan así:

| Tipo | En sitemap | Notas |
|---|---:|---|
| Fichas `/producto/` | 80 | Prioridad 0,7; `lastmod` = mtime del JSON |
| Posts `/blog/<slug>/` | 28 | |
| Taxonomías `/categoria/` | 15 | 7 categorías de producto + 8 secciones-problema, **mismo template** |
| Calculadoras | 4 | Sin `lastmod` en el sitemap (no están en el mapa de mtimes) |
| Home, `/productos/`, `/blog/`, `/herramientas/`, `/como-analizamos/`, `/preguntas-frecuentes/`, `/aviso-legal/` | 7 | |

Fuera del sitemap, y a menudo con `noindex` o `Disallow`:

| Tipo | ~N | Robots |
|---|---:|---|
| `/recomienda/<slug>/` (puente de afiliado) | 80 | `noindex,nofollow` + `Disallow: /recomienda/` |
| `/asistente/`, `/politica-privacidad/`, `/politica-cookies/`, 404 | 4 | `noindex` y/o filtradas del sitemap |

134 + 80 puentes ≈ **214**. El resto hasta 220 son slugs viejos, variantes sin barra, o URLs de blog mal pegadas que GSC sigue viendo (el snapshot lista 9 URLs con impresiones que ya no están en el sitemap).

**Lectura:** el techo de 220 no es “220 artículos”. Es el catálogo + el doble de URLs de afiliado + taxonomías duplicadas + historia de slugs. Las 77 indexadas del informe de cobertura coinciden en orden de magnitud con las **75 URLs que tuvieron ≥1 impresión en 30 días**.

---

## 1.1 Contenido único por ficha

### Qué se ha contado

Texto de la ficha (JSON): `analisis`, `veredicto`, `experienciaReal`, `paraQuien`, `pros`, `contras`, `descripcionSeo`, `tituloSeo`, `nombreCorto` y `descripcion` del fabricante.

**Excluido**, como pediste:

- Chrome de plantilla (breadcrumbs, CTA de Amazon, envío/garantía, “También te puede interesar”, footer, disclaimers).
- Nombres del carrusel de relacionados (varían por categoría, no son texto de esta ficha).
- Frases que se repiten en **más de 10 fichas**.

Hallazgo metodológico: **cero frases de ≥6 palabras y cero 8-gramas se repiten en más de 10 fichas.** El copy editorial se reescribió ficha a ficha. La duplicación no está en los JSON; está en la plantilla HTML, que es idéntica.

Plantilla compartida medida (cadenas fijas de ficha + header/footer): **222 palabras**. El carrusel de 8 relacionados añade del orden de 80–120 palabras más de chrome, no incluidas en el denominador.

- **Palabras únicas:** tokens que quedan en el JSON tras el filtro anterior (en la práctica ≈ todo el JSON, porque no hay boilerplate transversal).
- **Editorial:** lo mismo sin `descripcion` de fabricante.
- **Ratio:** palabras únicas / 222 de plantilla.

### Umbral

La distribución es **bimodal**, no un degradado:

| Grupo | N | Palabras únicas | Ratio |
|---|---:|---|---|
| Sin `analisis` ni `veredicto` (solo ficha de fabricante + `nombreCorto`) | 8 | 32–62 | 0,14–0,28 |
| Con análisis + veredicto | 72 | 235–383 (mediana 284) | 1,06–1,73 |

Entre 62 y 235 no hay nadie. El corte natural es ese hueco.

**Umbral: menos de 150 palabras únicas de ficha** (y ratio < 0,5). Por debajo, la página visible es mayoritariamente chrome + CTA. Es el perfil de “thin affiliate” que Google describe como poco útil frente a la ficha de Amazon. Las 8 fichas `Pendiente` caen ahí.

No uso 300 palabras como umbral. La mediana de las 72 analizadas es 284 y **la tasa de impresiones es la misma por encima y por debajo de 250–300** (~38 %). A partir de ~235 palabras, el recuento deja de predecir indexación. El techo del 65 % no indexado no se explica por “fichas de 280 palabras demasiado cortas”.

Las 8 del umbral ya tienen `tipoAnalisis: Pendiente`. Tres de ellas aún muestran impresiones (Gooddy 51, Pawk 5, Priorpet 5 peldaños 2): son **residuos de slugs antiguos o queries de marca**, no prueba de que Google trate la ficha actual como contenido de destino.

### Tabla (peor → mejor)

| # | Palabras únicas | Editorial | Ratio ún./plantilla | análisis | veredicto | tipoAnalisis | Impresiones GSC 30d | Categoría | Ficha |
|---:|---:|---:|---:|:---:|:---:|---|---:|---|---|
| 1 | 32 **↓ umbral** | 8 | 0.14 | no | no | Pendiente | 51 | Condroprotectores | Gooddy condroprotector · 100 snacks (300 g) (`condroprotector-articulaciones-100-snacks-300g-glucosamina-hci-condroitina-msm-colageno-y-vitaminas-c-y-e-suplemento-para-perros-antiinflamatorio-caderas-artrosis-huesos`) |
| 2 | 41 **↓ umbral** | 10 | 0.18 | no | no | Pendiente | 0 | Rampas | Priorpet escalera de coche · 4 peldaños (`para-perros-pequenos-o-grandes-priorpet-marca-que-brilla-en-la-oscuridad-rampa-de-coche-plegable-adecuada-para-todos-los-coches-superficie-antideslizante-4-escalones`) |
| 3 | 41 **↓ umbral** | 10 | 0.18 | no | no | Pendiente | 2 | Rampas | Priorpet escalera de coche · 5 peldaños (`para-perros-pequenos-o-grandes-priorpet-marca-que-brilla-en-la-oscuridad-rampa-de-coche-plegable-adecuada-para-todos-los-coches-superficie-antideslizante-5-escalones`) |
| 4 | 49 **↓ umbral** | 10 | 0.22 | no | no | Pendiente | 0 | Rampas | Escalera de coche 4 peldaños · 80 kg (`para-perros-coche-4-peldanos-plegable-ayuda-para-entrar-en-el-coche-para-todos-los-vehiculos-altura-ajustable-soporta-hasta-80-kg`) |
| 5 | 52 **↓ umbral** | 6 | 0.23 | no | no | Pendiente | 0 | Rampas | VEVOR escalera de coche 4 peldaños · 68 kg (`escaleras-para-perros-para-coche-de-4-escalones-carga-de-68-kg-rampa-plegable-para-perros-de-aluminio-ligero-con-superficie-antideslizante-escalones-portatiles-de-mascotas-para-coche-y-camion`) |
| 6 | 52 **↓ umbral** | 10 | 0.23 | no | no | Pendiente | 0 | Rampas | Pawaboo rampa sofá · 5,6–47 cm, nuez (`rampa-para-perros-mejorada-2026-para-sofa-rampa-plegable-para-perros-pequenos-para-sofa-con-7-alturas-ajustables-de-56-a-47-cm-rampas-portatil-antideslizante-para-sofas-nuez`) |
| 7 | 56 **↓ umbral** | 8 | 0.25 | no | no | Pendiente | 5 | Camas ortopédicas | Pawk cama ortopédica 107×81 · gris (`cama-perro-grande-sofa-perro-ortopedica-desmontable-y-lavable-colchon-perro-con-forro-impermeable-y-espuma-viscoelastica-107x81x19cm-gris`) |
| 8 | 62 **↓ umbral** | 10 | 0.28 | no | no | Pendiente | 0 | Rampas | Uross escalera de coche · 160 cm (`escalera-para-perros-para-coche-160-cm-escalera-plegable-para-perros-para-coche-y-suv-escalera-para-perros-de-aluminio-para-perros-grandes-escalera-extensible-para-perros-para-camiones-cama`) |
| 9 | 235 | 210 | 1.06 | sí | sí | Analizado | 0 | Condroprotectores | Omnicondro 20 Hifarmax · 60 comprimidos (`20-hifarmax-condroprotector-para-perros-y-gatos-glucosamina-y-condroitina-para-articulaciones-vitaminas-mascotas-suplementos-para-perros-mayores-60-comprimidos`) |
| 10 | 242 | 242 | 1.09 | sí | sí | Analizado | 0 | Alimentación específica | Farmina Vet Life Renal · 12 kg (`farmina-vet-life-dog-renal-12kg`) |
| 11 | 246 | 227 | 1.11 | sí | sí | Analizado | 0 | Condroprotectores | Zesty Paws probióticos digestivos · 90 uds (`zesty-paws-probioticos-digestivos-90-uds`) |
| 12 | 248 | 238 | 1.12 | sí | sí | Analizado | 4 | Condroprotectores | Kowi Flex Drops condroprotector · 60 ml (`kowi-flex-drops-condroprotector-gotas-60ml`) |
| 13 | 251 | 223 | 1.13 | sí | sí | Analizado | 15 | Condroprotectores | EGV Artimove condroprotector (`condroprotector-perros-antiinflamatorio-para-perros-protege-y-mejora-la-movilidad-articular-creado-por-veterinarios-especializados-artimove`) |
| 14 | 251 | 231 | 1.13 | sí | sí | Analizado | 0 | Condroprotectores | Omnicondro 10 Hifarmax · 60 comprimidos (`omnicondro-10-hifarmax-60-comprimidos`) |
| 15 | 252 | 229 | 1.14 | sí | sí | Analizado | 0 | Condroprotectores | JointSure condroprotector · 300 comprimidos (`condroprotector-perros-i-con-gran-concentracion-de-mejillon-labios-verdes-glucosamina-y-condroitina-natural-i-suplemento-antiinflamatorio-para-articulaciones-i-300-comprimidos`) |
| 16 | 256 | 235 | 1.15 | sí | sí | Analizado | 0 | Camas ortopédicas | Joyelf cama ortopédica grande viscoelástica (`joyelf-cama-ortopedica-grande-viscoelastica`) |
| 17 | 259 | 233 | 1.17 | sí | sí | Analizado | 0 | Camas ortopédicas | Ferplast Memor-One L memory foam (`ferplast-memor-one-l-memory-foam`) |
| 18 | 262 | 238 | 1.18 | sí | sí | Analizado | 0 | Alimentación específica | Advance Urinary · 3 kg (`veterinary-diets-urinary-pienso-para-perros-con-problemas-en-el-tracto-urinario-3kg`) |
| 19 | 264 | 242 | 1.19 | sí | sí | Analizado | 0 | Alimentación específica | Advance Renal Failure · 3 kg (`advance-veterinary-diets-renal-failure-3kg`) |
| 20 | 264 | 252 | 1.19 | sí | sí | Analizado | 1 | Alimentación específica | Royal Canin Renal RF14 · 14 kg (`canin-c-11232-diet-renal-rf14-14-kg`) |
| 21 | 265 | 243 | 1.19 | sí | sí | Analizado | 0 | Correas | Ferplast Ergocomfort correa · 120 cm (`ferplast-ergocomfort-correa-nailo-120cm`) |
| 22 | 265 | 244 | 1.19 | sí | sí | Analizado | 0 | Condroprotectores | YuMOVE condroprotector 9+ · 120 comprimidos (`yumove-condroprotector-9-anos-120-comprimidos`) |
| 23 | 266 | 246 | 1.20 | sí | sí | Analizado | 1 | Alimentación específica | Royal Canin Gastrointestinal GI25 · 2 kg (`royal-canin-veterinary-gastrointestinal-gi25-2kg`) |
| 24 | 267 | 243 | 1.20 | sí | sí | Analizado | 0 | Correas | Happy Hachi correa adiestramiento · 10 m (`happy-hachi-correa-adiestramiento-10m`) |
| 25 | 270 | 249 | 1.22 | sí | sí | Analizado | 7 | Alimentación específica | Royal Canin Renal salsa · 2×12×100 g (`canin-veterinary-renal-paquete-doble-2-x-12-x-100-g-alimento-dietetico-completo-para-perros-adultos-para-apoyar-la-funcion-renal-trozos-finos-en-salsa`) |
| 26 | 271 | 253 | 1.22 | sí | sí | Analizado | 0 | Ansiedad | Beaphar No Stress recambio · 30 ml (`no-stress-recambio-antiestres-natural-perro-30ml-recarga-antiestres-natural-perros-reduce-estres-y-ansiedad-ladridos-miedos-cambios-ruidos-marcaje-con-orina-conflictos`) |
| 27 | 273 | 226 | 1.23 | sí | sí | Analizado | 5 | Condroprotectores | MyPetPrime JointSupport · 125 comprimidos (`articulaciones-complemento-alimenticio-para-perros-125-comprimidos-nueva-formula-jointsupport-con-msm-polvo-de-mejillon-de-labio-verde-glucosamina-y-garra-del-diablo`) |
| 28 | 274 | 226 | 1.23 | sí | sí | Analizado | 2 | Condroprotectores | ivvi Hip and Joint · 60 golosinas (270 g) (`hip-and-joint-articulaciones-antiartrosis-complemento-alimenticio-para-perros-altamente-concentrado-msm-mejillon-de-labio-verde-glucosamina-60-golosinas-de-pollo-270g`) |
| 29 | 274 | 249 | 1.23 | sí | sí | Analizado | 0 | Alimentación específica | Virbac HPM Kidney Support K1 · 12 kg (`hpm-virbac-hpm-perro-k1-kidney-support-12kg-virbac-01224-12000-g`) |
| 30 | 275 | 227 | 1.24 | sí | sí | Analizado | 14 | Camas ortopédicas | WAVVE cama ortopédica XL · 112×81 cm (`wavve-cama-ortopedica-xl-perro-112x81`) |
| 31 | 275 | 237 | 1.24 | sí | sí | Analizado | 6 | Correas | lionto correa reflectante · 200 cm, negro (`correa-para-perros-con-tiras-reflectantes-correa-regulable-correa-de-adiestramiento-reflectante-correa-doblee-longitud-200-cm-negro`) |
| 32 | 275 | 249 | 1.24 | sí | sí | Analizado | 0 | Alimentación específica | Royal Canin Renal Special · 2 kg (`royal-canin-veterinary-renal-special-2kg`) |
| 33 | 276 | 265 | 1.24 | sí | sí | Analizado | 0 | Alimentación específica | Royal Canin Renal Small Dog · 1,5 kg (`royal-canin-canine-renal-small-dog-15-kg`) |
| 34 | 279 | 256 | 1.26 | sí | sí | Analizado | 0 | Camas ortopédicas | VOUNOT cama ortopédica + gel · 115×81 cm (`vounot-ortopedica-alfombrilla-gel-115x81cm`) |
| 35 | 279 | 257 | 1.26 | sí | sí | Analizado | 0 | Ansiedad | Adaptil Calm Value Pack · 3 × 48 ml (`calm-value-pack-para-perros-3-botellas-de-repuesto-feromonas-para-promover-el-bienestar-relajacion-continua-para-tu-perro-3-x-48-ml`) |
| 36 | 280 | 241 | 1.26 | sí | sí | Analizado | 8 | Condroprotectores | Aryany condroprotector snack masticable (`aryany-condroprotector-snack-masticable-perros`) |
| 37 | 280 | 254 | 1.26 | sí | sí | Analizado | 0 | Bozales | Trixie bozal Flex silicona · M–L (`trixie-bozal-flex-silicona-m-l`) |
| 38 | 280 | 257 | 1.26 | sí | sí | Analizado | 1 | Alimentación específica | Royal Canin Renal húmedo · 12 × 100 g (`royal-canin-veterinary-renal-humedo-12x100g`) |
| 39 | 281 | 247 | 1.27 | sí | sí | Analizado | 13 | Camas ortopédicas | EHEYCIGA cama ortopédica · 106×76 cm (`eheyciga-cama-ortopedica-viscoelastica-perro-106x76`) |
| 40 | 282 | 253 | 1.27 | sí | sí | Analizado | 0 | Alimentación específica | Royal Canin Veterinary Renal · 2 kg (`canin-veterinary-renal-2-kg-alimento-completo-dietetico-para-perros-adultos-de-todas-las-tallas-y-razas-bajo-contenido-de-fosforo`) |
| 41 | 284 | 261 | 1.28 | sí | sí | Analizado | 0 | Correas | Julius-K9 IDC Powerharness · Talla 0 (`julius-k9-idc-powerharness-arnes-talla-0`) |
| 42 | 285 | 239 | 1.28 | sí | sí | Analizado | 38 | Alimentación específica | Pets Purest aceite de salmón · 500 ml (`pets-purest-aceite-salmon-500ml`) |
| 43 | 286 | 263 | 1.29 | sí | sí | Analizado | 0 | Bozales | Ilepark bozal canasta silicona · Talla 4 (`ilepark-bozal-canasta-silicona-talla-4`) |
| 44 | 286 | 265 | 1.29 | sí | sí | Analizado | 7 | Ansiedad | Rescue Pets gotas serenidad · 20 ml (`pets-cuentagotas-serenidad-para-mascotas-ideal-para-viajes-visita-veterinaria-aseo-ruido-y-soledad-sin-alcohol-natural-y-vegano-botella-de-20-ml`) |
| 45 | 288 | 254 | 1.30 | sí | sí | Analizado | 0 | Bozales | Ohcozzy bozal canasta · Talla 2, negro (`ohcozzy-bozal-canasta-talla-2-negro`) |
| 46 | 290 | 237 | 1.31 | sí | sí | Analizado | 1 | Correas | Happy Hachi correa larga · 3 m, rojo (`happy-hachi-correa-larga-perro-3-metros-correas-adiestramiento-para-perros-nylon-larga-resistente-para-entrenamiento-camping-paseo-rojo`) |
| 47 | 291 | 250 | 1.31 | sí | sí | Analizado | 0 | Bozales | Ownpets bozal de cesta · Talla XL (`bozal-perro-grande-bozal-de-cesta-permite-jadear-y-beber-con-cubierta-movil-para-evitar-morder-masticar-y-lamer-ajustable-bozal-de-malla-de-aire-para-perros-agresivos-grande-xl`) |
| 48 | 291 | 251 | 1.31 | sí | sí | Analizado | 4 | Correas | Taglory correa adiestramiento · 5 m, negro (`correa-larga-perro-5m-correa-adiestramiento-perro-2-mosqueton-para-perros-pequenos-medianos-y-grandes-negro`) |
| 49 | 292 | 243 | 1.31 | sí | sí | Analizado | 0 | Ansiedad | SLE difusor feromonas · 2 + 4 recargas (`feromonas-para-perrosdifusor-calmante-para-perros-difusor-gato-perros-aranazos-soluciona-cambios-marcaje-orina-reduce-los-ladridos-2-difusores-4-recargas`) |
| 50 | 292 | 253 | 1.31 | sí | sí | Analizado | 0 | Bozales | Bozal de silicona flexible · XXL, negro (`para-perros-bozal-de-silicona-flexible-contra-mordeduras-ladridos-y-masticaciones-diseno-transpirable-adecuado-para-el-entrenamiento-de-perros-grandes-y-agresivos-negro-xxl`) |
| 51 | 293 | 241 | 1.32 | sí | sí | Analizado | 1 | Alimentación específica | Royal Canin Renal mousse · 12 × 200 g (`canin-veterinary-renal-12-x-200-g-alimento-dietetico-totalmente-natural-para-perros-adultos-puede-ayudar-a-la-funcion-renal-en-la-insuficiencia-renal-cronica-mousse`) |
| 52 | 294 | 269 | 1.32 | sí | sí | Analizado | 0 | Bozales | Trixie bozal lazo nylon · XL–XXL (`trixie-bozal-lazo-nylon-entrenamiento-xl-xxl`) |
| 53 | 295 | 253 | 1.33 | sí | sí | Analizado | 10 | Ansiedad | Heel Pacifeel jarabe calmante · 150 ml (`heel-pacifeel-jarabe-calmante-perros-gatos-150ml`) |
| 54 | 295 | 261 | 1.33 | sí | sí | Analizado | 0 | Bozales | Ohcozzy bozal canasta · Talla 3, negro (`ohcozzy-bozal-canasta-talla-3-negro`) |
| 55 | 295 | 271 | 1.33 | sí | sí | Analizado | 0 | Bozales | Arquivet bozal silicona XXL · 47–61 cm (`bozal-flexible-de-silicona-talla-xxl-para-perros-grandes-10x33x47-61cm-impide-morder-pero-permite-al-perro-beber-y-tomar-golosinas-anti-mordeduras`) |
| 56 | 297 | 246 | 1.34 | sí | sí | Analizado | 0 | Correas | Toozey correa larga · 10 m × 2 cm (`correa-perro-pequenos-a-grandes-y-medianos-con-gomas-antideslizantes-y-tiras-reflectantes-5m-10m-15m-20m-correa-larga-adiestramiento-de-perros-nylon-suave-y-resistente-10m-x-2cm`) |
| 57 | 297 | 258 | 1.34 | sí | sí | Analizado | 0 | Ansiedad | Coachi recompensas calmantes pavo · 100 g (`coachi-recompensas-calmantes-perros-pavo-100g`) |
| 58 | 299 | 247 | 1.35 | sí | sí | Analizado | 3 | Correas | Línea de entrenamiento nailon · 15 m (`linea-entrenamiento-perros-nailon-15m`) |
| 59 | 299 | 275 | 1.35 | sí | sí | Analizado | 0 | Camas ortopédicas | Bedsure cama ortopédica impermeable (`bedsure-ortopedica-grande-forro-impermeable`) |
| 60 | 300 | 270 | 1.35 | sí | sí | Analizado | 2 | Ansiedad | ThunderShirt chaleco antiansiedad (`thundershirt-chaleco-antiansiedad-para-perros`) |
| 61 | 303 | 273 | 1.36 | sí | sí | Analizado | 0 | Alimentación específica | Advance Renal Failure · 12 kg (`advance-veterinary-diets-renal-failure-pienso-para-perros-con-insuficiencia-renal-cronica-12kg`) |
| 62 | 306 | 255 | 1.38 | sí | sí | Analizado | 0 | Correas | Rudelkönig correa adiestramiento · 5 m (`rudelkonig-correa-perro-5-metros-ideal-para-adiestramiento-correa-larga-perro-robusta-y-resistente`) |
| 63 | 307 | 261 | 1.38 | sí | sí | Analizado | 0 | Correas | Halti correa adiestramiento L · negro (`halti-correa-de-adiestramiento-correa-multifuncion-con-doble-enganche-ideal-para-antitirones-entrenamiento-canino-comoda-de-sostener-apta-para-perros-medianos-y-grandes-talla-l-negro`) |
| 64 | 308 | 257 | 1.39 | sí | sí | Analizado | 15 | Ansiedad | Kowi Relax Drops relajante · 60 ml (`relax-drops-relajante-para-perros-y-gatos-con-l-triptofano-passiflora-valeriana-y-vitamina-b1-complemento-que-ayuda-a-calmar-la-ansiedad-y-el-estres-ingredientes-naturales-frasco-60-ml`) |
| 65 | 312 | 265 | 1.41 | sí | sí | Analizado | 52 | Condroprotectores | Condroprotector en gotas · 60 ml (`condroprotector-gotas-perros-mayores-60ml`) |
| 66 | 318 | 252 | 1.43 | sí | sí | Analizado | 0 | Correas | Joytale correa larga · 5 m, naranja (`joytale-correa-larga-perro-correa-adiestramiento-perro-510-1520-metros-cuerda-para-perros-correa-resistente-para-camping-paseo-naranja-5-metros`) |
| 67 | 318 | 266 | 1.43 | sí | sí | Analizado | 0 | Correas | Edipets correa adiestramiento · 150 cm, negro (`correa-perro-correas-para-perros-para-cachorro-pequenos-medianos-y-grandes-12-m-15-m-22-m-correa-perro-adiestramiento-150-cm-negro`) |
| 68 | 320 | 252 | 1.44 | sí | sí | Analizado | 0 | Bozales | Trixie bozal Flex silicona L · negro (`trixie-bozal-flex-silicona-l-negro-perro`) |
| 69 | 323 | 252 | 1.46 | sí | sí | Analizado | 0 | Camas ortopédicas | EHEYCIGA cama XL 106×76 · negro (`eheyciga-cama-ortopedica-y-viscoelastica-para-perro-extra-grande-106x76x185-cm-memory-foam-sofa-para-perros-lavable-cama-gato-suave-negro`) |
| 70 | 328 | 234 | 1.48 | sí | sí | Analizado | 1 | Condroprotectores | YuMOVE senior +8 años · 30 masticables (`yumove-condroprotector-perros-30-masticables-articulaciones-perro-senior-8-anos-con-mejillon-labio-verde-complejo-activease-de-150mg-cada-masticable-aceite-de-pescado-movilidad-del-canino`) |
| 71 | 328 | 278 | 1.48 | sí | sí | Analizado | 1 | Rampas | Escalera de coche 4 peldaños · 101×75 cm (`para-perrosrampa-para-perros-cocheescalera-perros-4-peldanos-plegableshasta-80kg-cargablepara-gatos-perroscachorros-perro-viejopara-todos-los-vehiculos-negro-101-75-47cm`) |
| 72 | 328 | 279 | 1.48 | sí | sí | Analizado | 0 | Correas | COMSLE correa larga violeta · 5/10/15 m (`comsle-correa-larga-reflectante-perro-violeta`) |
| 73 | 329 | 289 | 1.48 | sí | sí | Analizado | 0 | Bozales | Bozal de cesta silicona · Talla 6, negro (`bozal-para-perros-cesta-de-siliconapermite-beberjadear-y-comernegro-6`) |
| 74 | 331 | 260 | 1.49 | sí | sí | Analizado | 0 | Camas ortopédicas | EHEYCIGA cama XL 106×76 · gris oscuro (`eheyciga-cama-ortopedica-y-viscoelastica-para-perro-extra-grande-106x76x185-cm-memory-foam-sofa-para-perros-lavable-cama-gato-suave-gris-oscuro`) |
| 75 | 331 | 284 | 1.49 | sí | sí | Analizado | 0 | Ansiedad | Adaptil Calm recambio · 48 ml (`calm-antiestres-para-perros-solo-en-casa-miedos-ruidos-fuertes-adopcion-recambio-48ml`) |
| 76 | 337 | 290 | 1.52 | sí | sí | Analizado | 2 | Ansiedad | Adaptil Calm pack 3 recambios · 90 días (`calm-pack-ahorro-3-recambios-90-dias-antiestres-para-perros`) |
| 77 | 340 | 274 | 1.53 | sí | sí | Analizado | 0 | Bozales | Bozal de cesta Baskerville Ultra · Talla 4 (`museruola-baskerville-ultra-design-etico-brevettato-cane-puo-respirare-ansimare-e-bere-regolabile-imbottita-addestramento-cani-piccoli-medi-grandi-impedisce-di-morsicare-rovistare-taglia-4`) |
| 78 | 347 | 274 | 1.56 | sí | sí | Analizado | 0 | Bozales | Cablepelado bozal canasta S · beige 4,5 cm (`cablepelado-bozal-para-perro-bozal-de-canasta-para-perros-evitar-morder-bozal-de-canasta-ajustable-ajustable-medida-circunferencia-del-hocico-45-cm-beige-talla-s`) |
| 79 | 348 | 252 | 1.57 | sí | sí | Analizado | 2 | Camas ortopédicas | EHEYCIGA cama extra grande 112×81 · gris (`eheyciga-cama-perro-extra-grande-112x81x16cm-colchon-perro-impermeable-lavable-con-espuma-viscoelastica-sofa-perro-ortopedica-desmontable-gris`) |
| 80 | 383 | 283 | 1.73 | sí | sí | Analizado | 3 | Rampas | Bacoeng rampa plegable · 180 cm, 110 kg (`bacoeng-rampa-plegable-perros-180cm`) |


### Qué implica

Las 72 fichas “Analizado” tienen de verdad texto propio (~210–290 palabras editoriales). Eso no las hace destinos para Google: el HTML alrededor es el mismo, el schema Product+Offer es el mismo, el CTA es el mismo, y 50 de las 80 no tuvieron ni una impresión en 30 días.

---

## 1.2 Canibalización entre taxonomías

Siete categorías de producto y ocho secciones-problema salen de **`src/pages/categoria/[slug].astro`**. Mismo grid, mismos bloques “El problema / Cuándo conviene / Qué mirar”, distinto copy de guía.

La home **no enlaza las 7 categorías**. Oculta las que ya cubre una sección-problema (`CATEGORIES_COVERED_BY_PROBLEM_SECTIONS`) y muestra las 8 secciones. El footer hace lo contrario: lista categorías de producto. Dos sistemas de URLs promocionados desde sitios distintos del chrome.

Ningún producto define `seccionPrimaria`; la pertenencia sale del array `secciones` del JSON.

Texto único de cada hub (guía de la página, sin el grid):

| Hub | Tipo | Palabras únicas de guía | Productos |
|---|---|---:|---:|
| Condroprotectores | categoría | 112 | 13 |
| Camas ortopédicas | categoría | 122 | 10 |
| Rampas | categoría | 121 | 8 |
| Correas | categoría | 120 | 13 |
| Bozales | categoría | 135 | 12 |
| Ansiedad | categoría | 115 | 10 |
| Alimentación específica | categoría | 114 | 14 |
| Movilidad y artrosis | sección | 163 | 21 |
| Descanso ortopédico | sección | 154 | 10 |
| Problemas renales y urinarios | sección | 168 | 12 |
| Digestión sensible | sección | 152 | 2 |
| Ansiedad y estrés | sección | 171 | 10 |
| Perros senior | sección | 148 | 32 |
| Paseos seguros y control | sección | 181 | 25 |
| Subir al coche o sofá | sección | 165 | 8 |

El copy de guía **no está copiado** entre categoría y sección (textos distintos, ~110–180 palabras). Lo que se solapa es el **listado de productos** y la plantilla.

### Pares con solape de productos

| Categoría | Sección | Compartidos | % de la categoría | % de la sección | Impresiones 30d (cat / sección) | ¿Compiten de verdad? |
|---|---|---:|---:|---:|---|---|
| Ansiedad | Ansiedad y estrés | 10 | **100 %** | **100 %** | 0 / 0 | **Sí.** Mismo set, misma intención (“ansiedad perro”). Dos URLs para un clúster que ya cubren 3 posts. |
| Camas ortopédicas | Descanso ortopédico | 10 | **100 %** | **100 %** | 8 / **38** | **Sí.** Google elige la sección-problema (mejor posición, más impresiones). La categoría queda residual. |
| Rampas | Subir al coche o sofá | 8 | **100 %** | **100 %** | 0 / 2 | **Sí.** Duplicado total. Ninguna rankea; el post de rampas (105 impr.) se lleva la query. |
| Condroprotectores | Movilidad y artrosis | 13 | **100 %** | 62 % | **826** pos 72 / **93** pos 11 | **Sí.** La categoría absorbe volumen de “condroprotector perros” sin rankear (pos ~72, 0 clics). La sección rankea mejor con menos volumen y además mezcla rampas. |
| Bozales | Paseos seguros y control | 12 | **100 %** | 48 % | 0 / 0 | **Parcial.** La sección mezcla bozales+correas (intenciones distintas). Las dos URLs de taxonomía están muertas; rankea el post de talla de bozal (478 impr.). |
| Correas | Paseos seguros y control | 13 | **100 %** | 52 % | 1 / 0 | **Parcial.** Igual que el anterior. |
| Rampas | Movilidad y artrosis | 8 | **100 %** | 38 % | 0 / 93 | **Parcial.** Las rampas se diluyen dentro de un hub de articulaciones. |
| Rampas | Perros senior | 8 | **100 %** | 25 % | 0 / 0 | **Perros senior es el sumidero.** |
| Camas ortopédicas | Perros senior | 10 | **100 %** | 31 % | 8 / 0 | **Perros senior es el sumidero.** |
| Condroprotectores | Perros senior | 13 | **100 %** | 41 % | 826 / 0 | **Perros senior es el sumidero.** |
| Alimentación específica | Problemas renales y urinarios | 12 | 86 % | **100 %** | 22 pos 30 / 0 | **Sí, en renal.** La categoría también tiene GI + aceite de salmón; la sección es un subconjunto. GSC solo mueve la categoría, y poco. |
| Alimentación específica | Digestión sensible | 1 | 7 % | 50 % | 22 / 0 | No. Un producto (GI25). |
| Condroprotectores | Digestión sensible | 1 | 8 % | 50 % | — | No. Zesty Paws está mal encajado (probiótico en condroprotectores). |
| Alimentación específica | Perros senior | 1 | 7 % | 3 % | — | No. Solo el aceite de salmón. |

Solape entre secciones (mismo template, no pedido como par categoría–sección, pero es el mismo problema):

- **Movilidad y artrosis ⊂ Perros senior** (21/21).
- **Descanso ortopédico ⊂ Perros senior** (10/10).
- **Subir al coche ⊂ Movilidad ⊂ Perros senior** (8/8).

`/categoria/perros-senior/` es un hub de 32 productos que replica tres categorías y tres secciones. 0 impresiones. Es la URL que más diluye señales y menos aporta.

### Cuáles compiten de verdad (prioridad)

1. **Ansiedad / Ansiedad y estrés** — duplicado 1:1.
2. **Camas ortopédicas / Descanso ortopédico** — duplicado 1:1; Google ya eligió Descanso.
3. **Rampas / Subir al coche o sofá** — duplicado 1:1.
4. **Condroprotectores / Movilidad y artrosis** — la query comercial más grande del sitio se parte en dos URLs.
5. **Perros senior** — no compite por una query propia; canibaliza a las tres anteriores.

Bozales+Correas vs Paseos es ruido de arquitectura más que dos páginas peleando la misma SERP (ninguna de las tres tiene impresiones).

---

## 1.3 Fichas casi duplicadas (talla / color / formato)

El análisis editorial se reescribió, así que el `analisis` **no** es un copypaste (similitud de secuencia ~0,02–0,11). Lo que se copia es la **descripcion de fabricante** y la intención (mismo producto, otro SKU de Amazon).

### Grupos claros de variante (consolidar en una ficha + selector)

**A. EHEYCIGA cama XL 106×76 · gris vs negro**

- ASINs distintos (`B0DPZZ831Q` / `B0FGP7T6PQ`), misma medida, mismo copy de fabricante **literalmente idéntico** (71 palabras, seq 1,00).
- El análisis se reescribió para decir “la única diferencia es el color”.
- Slugs kilométricos distintos en sitemap; la variante corta `eheyciga-cama-ortopedica-viscoelastica-perro-106x76` (otro modelo, plano) es la que tiene 13 impresiones.
- **Consolidar.** Una URL, selector de color. Dos URLs no aportan query distinta (“cama ortopédica negra” no justifica ficha propia).

**B. Ohcozzy bozal canasta talla 2 vs talla 3 (negro)**

- Descripcion de fabricante seq **0,97** (solo cambian los cm: 21,5–25,5 vs 25,5–28,5).
- Análisis distinto (~80 palabras cada uno) pero misma tesis: tabla de tallas, silicona, jadear.
- 0 impresiones las dos.
- **Consolidar** en una ficha Ohcozzy con tabla de tallas 1–6 y selector. La query es “bozal talla X / cómo medir”, no “Ohcozzy talla 3 vs 2”. La calculadora de talla ya cubre esa intención.

**C. Priorpet escalera 4 vs 5 peldaños**

- Descripcion **idéntica**. Sin análisis. Ambas bajo el umbral de 1.1.
- **Consolidar.** Una ficha, peldaños como variante. Hoy son dos URLs pobres.

**D. Adaptil Calm recambio 48 ml vs pack 3 recambios (90 días)**

- Descripcion **idéntica**. Análisis reescrito (seq 0,02) para hablar del formato.
- Hay un tercer SKU (Value Pack 3×48 ml) con descripcion distinta y el mismo problema de línea.
- **Consolidar** recambio + packs en una ficha Adaptil Calm. El pack vs recambio es un selector, no dos reseñas.

### Grupos de línea (misma marca, no solo talla/color)

**E. Trixie Flex silicona M–L vs L negro** (y el lazo de nylon, que es otro producto)

- No son copypaste de fabricante (seq 0,23). Sí son el mismo modelo en talla/color, mismo recuento de reseñas (558).
- **Consolidar las dos Flex** en una ficha con tallas. El lazo de nylon debe quedar aparte (uso distinto; la calculadora lo excluye).

**F. Advance Renal Failure 3 kg vs 12 kg**

- Misma dieta, otro saco. Descripcion seq 0,43. Análisis distinto.
- **Una ficha, selector de formato.** Las queries son “pienso renal Advance”, no el peso del saco.

**G. Omnicondro 10 vs 20**

- Misma línea, distinta concentración. Descripcion seq 0,48.
- **Una ficha con las dos concentraciones.** Si no, Google indexará como mucho una.

**H. Royal Canin Renal (húmedo 12×100 g, mousse 12×200 g, salsa 2×12×100 g, 2 kg, Special 2 kg, Small Dog 1,5 kg, RF14 14 kg)**

- No son duplicados literales (descripciones 0,13–0,50), pero son **siete URLs para una dieta veterinaria**. GSC solo mueve de forma testimonial 1–7 impresiones en un par de ellas.
- **Hub “Royal Canin Renal” + formatos**, no 7 fichas hermanas. Fuera de alcance de este informe (no borrar slugs aquí); es el mayor nido de SKUs del catálogo.

**I. Escaleras de coche de 4 peldaños** (Priorpet, VEVOR, Uross, genérica 80 kg, otra 101×75)

- Cinco URLs, cuatro sin análisis, descripciones de fabricante distintas pero la misma ficha de Amazon “escalera 4 peldaños”.
- No son variantes de un mismo ASIN; son competidores. El problema no es consolidar color, es **demasiadas fichas pobres del mismo tipo**. Priorizar 1–2 analizadas y dejar el resto como `Pendiente` (ya lo están) o fuera de sitemap más adelante.

### Qué no consolidar

YuMOVE 9+ 120 comprimidos vs senior 30 masticables: formatos y posicionamiento distintos, descripcion seq 0,08. Pueden convivir si alguna rankea.

### Recomendación de arquitectura (sin tocar slugs en esta sesión)

Donde el fabricante es el mismo y solo cambian talla, color o metros de saco, una URL canónica + selector. Las URLs hermanas, cuando se haga, deberían 301 a esa canónica — hay 44 redirects `/producto/` ya en nginx (`deploy/nginx/redirects.conf`) precisamente por cambios de slug anteriores. Cada cambio de slug vuelve a poner el reloj de indexación a cero.

---

## 1.4 Comparativa con lo que sí se indexa (o al menos se imprime)

Proxy: URLs del sitemap o de GSC con impresiones en 18 ago–16 sep. 65 de 134 URLs del sitemap tuvieron impresiones. 50 de 80 fichas, 0.

### Lo que Google está usando como destino

| Clase | Ejemplos | Palabras de contenido | Patrón |
|---|---|---|---|
| Guías de problema concreto | `condroprotectores-perros-guia-completa` (1144 impr.), `bozales-perros-guia-elegir-talla` (478), `mi-perro-se-rasca-mucho-sin-pulgas` (359), `pienso-renal-perros-guia` (252) | 600–1400 | Query de usuario en el título, FAQs, no son un grid de SKUs |
| Herramienta que responde una medida | Calculadora de dosis (319 impr., pos 3,9); talla de bozal (33, pos 6,2); medida de rampa (16) | ~250–300 visibles + FAQs + tabla | Intención “calcula X”; no sustituible por una ficha de Amazon |
| Hub de categoría con demanda | `/categoria/condroprotectores/` (826 impr. **pos 72**, 0 clics) | ~112 de guía + grid | Google la *muestra* en queries grandes y no la elige |
| Producto-entidad con query de marca o inbound de blog | Aceite Pets Purest (38 impr.), Kowi gotas, Wavve, Aryany | ~250–310, **igual que las que no indexan** | Nombre buscable, o enlace desde un post que sí rankea (Aryany 8 enlaces desde el blog) |
| Home | 55 impr. | — | Marca |

### Lo que no está usando, aunque el recuento de palabras sea similar o mayor

- **50/80 fichas** con análisis de ~250–340 palabras y 0 impresiones. Incluye Ohcozzy, EHEYCIGA gris/negro, Baskerville, la mayoría de Royal Canin, Thundershirt, camas Joyelf/Ferplast/Bedsure.
- **Taxonomías duplicadas** (ansiedad, bozales, rampas, perros-senior, paseos, digestión, problemas renales): 0 o casi 0.
- **Posts largos sin query o canibalizados:** `mejores-camas-ortopedicas-perros` (1155 palabras, publicado oct 2025, **0 impr.**), `golden-retriever-guia-cuidados-completa` (1523 w, 0), `ansiedad-separacion-perros-guia` (1309 w, nov 2025, 0), `perro-tira-de-la-correa-soluciones` (1292 w, oct 2025, 0). La longitud no salva un título que no se busca o un clúster ya cubierto.
- **Calculadora de cama** (en sitemap, 0 impr.). Ver `docs/auditoria-calculadoras.md`.
- **`/productos/`, `/como-analizamos/`, `/preguntas-frecuentes/`.**

### El patrón (no es “más palabras”)

Las páginas que Google trata como destino tienen **una intención que no existe en Amazon.es**:

1. Pregunta de dueño (“se rasca y no tiene pulgas”, “talla de bozal”, “dosis de glucosamina”).
2. Formato que Amazon no ofrece (calculadora, guía con criterio).
3. A veces, una entidad de marca que la gente escribe (Pets Purest, un condro concreto).

Las que no: **ficha de SKU con el mismo esqueleto HTML que las otras 79**, aunque el párrafo central sea único. Eso es exactamente el tipo de página que el sistema de contenido útil agrupa y deja en “rastreada, no indexada”. El recuento de 280 palabras únicas no las saca de esa clase.

Señal interna que sí correlaciona mejor que las palabras: **enlace desde un post que ya rankea**. Aryany, Coachi, YuMOVE 9+, aceite de salmón tienen inbound de blog (3–8 enlaces) y aparecen en GSC. La mayoría de bozales/camas/rampas hermanas no.

Señal que confunde: slugs viejos de productos borrados (Ksiia, CO-Z, Nobleza, YuMOVE 60 uds, Purina Neurocare) **siguen imprimiendo**. El índice está sucio; parte del crawl budget se va a 301 y a URLs muertas.

---

## 1.5 Tres hipótesis (por probabilidad)

### 1. Clasificador de “sitio de fichas de afiliado” (≈ 55 %)

Google rastrea el catálogo, ve 80 URLs `/producto/` con el mismo layout, el mismo Product schema, el mismo CTA a Amazon y un párrafo de ~250 palabras, y **elige no indexar la clase**, salvo excepciones (marca buscable, leftover de slug, o empujón de un post fuerte). Las 8 thin refuerzan la clase; las 72 analizadas no la rompen.

**A favor**

- 72 fichas con análisis único y la misma tasa de impresiones (~38 %) que si no se corta por palabras.
- 50 fichas a 0 impresiones con mediana de 284 palabras únicas.
- 80 `/recomienda/` noindex + `Disallow` hinchan el descubierto y huele a sitewide affiliate.
- Hubs y herramientas (formatos que Amazon no tiene) sí entran.

**En contra / matices**

- Algunas fichas thin (Gooddy) imprimen por inercia de URL, no por calidad.
- El dominio es pequeño y relativamente nuevo; el mismo patrón se ve en sitios nuevos sin ser un veredicto de calidad.

**Dato que la confirma:** inspección de URL en GSC de 3 fichas analizadas sin impresiones (p. ej. Baskerville, Ohcozzy talla 3, Joyelf) → “Rastreada, no indexada” o “Duplicada, Google ha elegido otra”. Si salen “Indexada” con 0 impresiones, esta hipótesis pierde peso (pasaríamos a demanda/canibalización).

**Dato que la descarta:** esas 3 pasan a “Indexada” y empiezan a imprimir sin cambiar el template, solo con enlaces o tiempo.

### 2. Canibalización de taxonomía + variantes SKU (≈ 30 %)

Google no sabe cuál es la URL canónica de “camas ortopédicas”, “bozal talla”, “pienso renal” o “EHEYCIGA 106×76”. Elige una (a menudo el post o la sección-problema) y deja el resto fuera. Las 15 URLs `/categoria/` para 7 temas reales y las parejas color/talla multiplican candidatos.

**A favor**

- Camas: Descanso 38 impr. vs categoría 8 vs post “mejores camas” 0 vs calculadora 0 vs 10 fichas.
- Condro: post 1144 + categoría 826 pos 72 + calculadora 319 + 13 fichas peleando el resto.
- Bozal: el post (478, pos 6,5) y la calculadora (33, pos 6,2) viven; categoría y fichas, no.
- Variantes con descripcion idéntica (EHEYCIGA color, Priorpet 4/5, Adaptil pack).

**Dato que la confirma:** en “Inspección de URL” / “página canónica seleccionada por Google”, las fichas hermanas y `/categoria/camas-ortopedicas/` apuntan a Descanso, al post o a otra ficha. Search Console → “Páginas alternativas con etiquetas canónicas adecuadas” o “Duplicada sin canónica definida por el usuario”.

**Dato que la descarta:** cada URL de un par duplicado aparece como indexada con canónica propia. Entonces el problema no es consolidar señales, es que no hay demanda o hay un clasificador de clase (hipótesis 1).

### 3. Presupuesto de rastreo gastado en URLs que no deberían competir (≈ 15 %)

220 descubiertas vs 134 en sitemap. 80 puentes `/recomienda/` (enlazados desde cada CTA de ficha). 44 redirects de producto en nginx (`deploy/nginx/redirects.conf`). 9 URLs con impresiones que ya no existen. Calculadoras sin `lastmod`. Google gasta crawl en fantasmas y no vuelve a las 50 fichas nuevas.

**A favor**

- El recuento 77+63+21 = 161 deja ~59 URLs en otros cubos de exclusión (noindex, robots, 301), coherente con `/recomienda/` + legales.
- 21 “descubiertas no rastreadas” encaja con URLs vistas en enlaces (puentes, slugs viejos) a las que robots.txt dice que no entre, o a las que no llega el presupuesto.
- Productos borrados siguen en GSC.

**En contra**

- Un sitio de ~150 URLs útiles no debería tener un techo serio de crawl. Google rastrea las 63 “no indexadas”: **llegó y dijo que no**. Eso es decisión de índice, no de cola de crawl.
- Las calculadoras nuevas de bozal y rampa sí se rastreaton e imprimieron en 7 días; la de cama, no. Mismo sitemap, mismo día de publicación.

**Dato que la confirma:** el informe de rastreo (estadísticas de crawl) muestra mucho 301/404/`/recomienda/` y poco 200 en `/producto/` reciente. Las 21 no rastreadas son sobre todo `/recomienda/` o slugs viejos.

**Dato que la descarta:** crawl stats limpios (casi todo 200 en URLs de sitemap) y las 63 no indexadas son fichas 200 con contenido. Entonces volvemos a 1 y 2.

---

## Qué no he podido cerrar (ambiguo a propósito)

- Cobertura exacta URL a URL (el snapshot es rendimiento, no el CSV de “por qué las páginas no están indexadas”).
- Si la calculadora de cama está “no indexada” o “indexada con 0 queries” (ver auditoría de calculadoras).
- Si Gooddy (51 impr., 32 palabras) imprime por la URL actual o por la anterior; el informe semanal ya la marcó como caída de posición.
- No he pedido reindexación ni cambiado canónicas: fuera de alcance de este bloque.

## Orden de ataque si el techo es la indexación

1. Inspeccionar en GSC 5 URLs: 2 fichas analizadas a 0 impr., 1 variante EHEYCIGA, `/categoria/camas-ortopedicas/`, la calculadora de cama. Eso confirma o mata las hipótesis 1–2.
2. Dejar de mandar señales a duplicados: no hace falta borrar fichas; sí hace falta **una URL de hub por tema** (la home ya eligió secciones-problema) y no promocionar la categoría hermana en el footer.
3. Variantes talla/color → una ficha cuando se pueda sin romper slugs a lo loco (cada 301 nuevo cuesta semanas).
4. Completar las 8 `Pendiente` o no tratarlas como equivalentes a las analizadas (el bloque 3 de esta sesión va en esa dirección).
5. No añadir más SKUs de la misma línea (otro Royal Canin Renal, otra talla Ohcozzy) hasta que las URLs actuales entren al índice.

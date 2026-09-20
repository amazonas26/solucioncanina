# Oportunidades de calculadoras

Fecha: 20 septiembre 2026.  
Fuentes: `docs/patron-calculadoras.md`, `docs/auditoria-calculadoras.md`, catálogo vivo (77 fichas), 33 posts, snapshot GSC `scratch/gsc/2026-09-17.json` (propiedad `sc-domain:solucioncanina.es`, 19 ago–17 sep; queries de la semana 11–17 sep).

**Veredicto:** no construir una 7ª calculadora ahora. Activar las tres que ya existen y no imprimen —sobre todo **ración renal**— rinde más que cualquiera de las cinco ideas propuestas. Entre esas cinco, **ninguna** supera el listón impacto/riesgo del patrón que ya funciona. No hay seis ideas mediocres que merezcan cola: hay **cero** candidatas nuevas listas, y un trabajo operativo sobre URLs que ya están en el sitemap.

---

## 1. Hechos (para no discutir de memoria)

### 1.1 Patrón que convierte

Cada calculadora útil en este sitio es:

1. Una query informacional que **Amazon no responde** con una ficha.
2. Un inbound desde **un post que ya imprime**.
3. **≥4–8 productos** de la misma categoría para el bloque de afiliación.
4. YMYL manejable con disclaimer, **sin inventar datos clínicos**.

Referencia: `docs/patron-calculadoras.md`. Lo que no cumple las cuatro no replica el caso condroprotector.

### 1.2 Las 6 actuales vs GSC 30 días

Clics GSC del sitio: **89**. Las tres calculadoras que imprimen suman **30 clics** (34 % de clics GSC). El «43 % de clics / 3 % de páginas» encaja con analytics de producto en otra ventana; el sitemap del snapshot tiene **141 URLs**, 6 calculadoras ≈ **4 %**.

| Calculadora | Catálogo | Blog inbound que imprime | Imp. 30d | Clics 30d | Estado |
| --- | --- | --- | ---: | ---: | --- |
| Dosis condroprotector | Condroprotectores (12) | guía condro (1123), glucosamina (200), artrosis… | **320** | **22** | Líder |
| Talla bozal | Bozales (12) | guía talla bozal (489 / 6) | 38 | 4 | Arranca |
| Medida rampa | Rampas (8) | beneficios rampas (120 / 1) | 24 | 4 | Arranca |
| Talla cama | Camas ortopédicas (9) | «mejores camas» **0 impr.**; artrosis/displasia 47 / 0 | **0** | 0 | Huérfana GSC |
| Talla arnés/collar | Correas (13), **1 arnés** | guía arnés 20 impr. | **0** | 0 | Huérfana |
| Ración pienso renal | Alimentación específica (14, casi todo renal) | **guía renal 251 impr. / 10 clics** | **0** | 0 | Huérfana con inbound fuerte |

`/herramientas/`: 1 impresión en 30 días. No arrastra.

El propio snapshot GSC (`actions`) ya pide: «Dar visibilidad a la calculadora de ración de pienso renal».

### 1.3 Catálogo (conteos reales)

| Categoría | N | ¿Sostiene una calculadora nueva? |
| --- | ---: | --- |
| Alimentación específica | 14 | 11 renal + 1 urinary + 1 GI + 1 aceite. **Cero pienso de mantenimiento** |
| Correas | 13 | Casi todo correas largas; 1 arnés (Julius-K9) |
| Bozales | 12 | Ya cubierta |
| Condroprotectores | 12 | Ya cubierta |
| Ansiedad | 9 | Feromonas / gotas / chaleco: **no hay fórmula mg/kg única** |
| Camas ortopédicas | 9 | Ya cubierta (0 impr. de la calc) |
| Rampas | 8 | Ya cubierta |

No hay básculas, bebederos, pienso light, ni sacos de mantenimiento.

### 1.4 Queries del snapshot (semana 11–17 sep, 119 filas)

Limitación ya documentada: GSC oculta queries bajo umbral de privacidad. «No sale en el snapshot» ≠ «volumen cero en España». Sí es «no hay demanda demostrable *hacia este sitio*».

| Tema | ¿En el snapshot? |
| --- | --- |
| Condro / dosis / glucosamina | Sí (volumen; pos. lejanas en genéricas) |
| Rasca / pelo | Sí (~95 impr. agrupadas) — formato **guía**, no calculadora |
| Ansiedad / estrés | Sí (~35 impr.) — el blog ya cubre; no hay calc |
| Bozal / medir | Sí (pocas, posiciones buenas) |
| Rampa | Sí (pocas) |
| Pienso renal | Sí (bajo, cubierto por la guía) |
| Edad canina / años humanos | **Ninguna** (cuidado: `edad` matchéa «ansiedad») |
| Peso ideal / «debe pesar» | **Ninguna** |
| Coste / gasto anual | **Ninguna** |
| Ración / «cuánto pienso» (no renal) | **Ninguna** |
| Agua / hidratación | **Ninguna** |

---

## 2. Ranking por ratio impacto / riesgo

Impacto = demanda demostrada × inbound × camino de afiliación × contenido único no canibalizado.  
Riesgo = YMYL + agujero de catálogo + canibalización + vanity.

| Rank | Idea | Ratio | Acción |
| ---: | --- | --- | --- |
| **0** | Activar **ración renal** (ya construida) | Máximo | Indexación + CTR + un refuerzo de enlace desde la guía de 251 impr. El informe semanal ya lo marca |
| **0b** | Activar **arnés** y revisar **cama** | Alto / medio | Arnés: catálogo sesgado a correas. Cama: el pilar «mejores camas» está a 0 impr. (`docs/auditoria-calculadoras.md`) |
| — | *Corte: no construir URL nueva por debajo* | | |
| 1 | Ración de pienso **normal** | Muy bajo | Misma ingeniería que la renal, **0 productos** |
| 2 | Edad canina por tamaño | Muy bajo | 0 GSC, 0 afiliación |
| 3 | Coste anual del perro | Muy bajo | 0 GSC, catálogo cubre un slice |
| 4 | Peso ideal por raza | Bajo (riesgo ↑) | 0 GSC, YMYL alto, 0 productos de peso |
| 5 | Agua diaria | Mínimo | 0 GSC, 0 productos, YMYL alto junto a contenido renal |

**Si hubiera que elegir “la siguiente URL nueva” entre las cinco propuestas: ninguna.** La siguiente unidad de trabajo no es una página, es hacer que `/calculadora-racion-pienso-renal-perros/` imprima.

---

## 3. Evaluación de las ideas pedidas

### 3.1 Conversor de edad canina por tamaño — no

| Criterio | Valor |
| --- | --- |
| Query | «edad perro en años humanos», «cuántos años humanos tiene mi perro». **0 filas** en GSC local |
| Catálogo | Ningún SKU se vende después de «tu perro tiene 42 años humanos». El puente a `/categoria/perros-senior/` es forzado |
| Inbound blog | Las guías de raza mencionan longevidad; **no hay pilar de edad**. Labrador 43 impr.; Golden **0**; Pastor 25; Bulldog 5; Border 260 (otro tema) |
| Contenido único | Bajo: tablas ×7 / por tamaño están en miles de sitios. Poco de «Amazon no tiene esto» |
| YMYL | Bajo–medio (curiosidad). Sube si se vende como salud sénior |
| **Por qué no** | Tráfico vanity sin conversión. Rompe el patrón medida → compra |

### 3.2 Calculadora de peso ideal por raza — no ahora

| Criterio | Valor |
| --- | --- |
| Query | «peso ideal labrador», «cuánto debe pesar…». Demanda SEO genérica **no demostrada aquí** (0 en GSC) |
| Catálogo | **No hay** básculas, pienso light ni dietas de pérdida de peso. El puente «el sobrepeso empeora articulaciones» hacia condro/cama es débil |
| Inbound blog | Labrador y displasia ya hablan de peso. Encaje editorial sí; producto no |
| Contenido único | Alto *si* se publican rangos por raza + BCS con **fuentes clínicas reales**. Eso no se inventa |
| YMYL | **Alto** (obesidad / peso objetivo = consejo sanitario) |
| **Por qué no** | Riesgo alto, afiliación nula. Mejor un párrafo de peso en las guías de raza con enlace a condro/cama, sin herramienta clínica |

### 3.3 Calculadora de coste anual del perro — no

| Criterio | Valor |
| --- | --- |
| Query | «cuánto cuesta un perro al año». **0 en GSC** |
| Catálogo | Inputs genéricos (pienso, vet, seguro). El catálogo solo cubre un **slice** (condro, camas, rampas…). Empujar esos SKUs como «gasto anual» es frágil |
| Inbound blog | Golden menciona coste; no hay guía de presupuesto |
| Contenido único | Medio (simulador), poco durable frente a medios generalistas |
| YMYL | Bajo |
| **Por qué no** | Engagement sin path de afiliación del catálogo actual |

### 3.4 Calculadora de ración diaria de pienso **normal** (no renal) — no

| Criterio | Valor |
| --- | --- |
| Query | «cuánto pienso darle». **0 en GSC** (sí hay queries de pienso **renal**) |
| Catálogo | **Bloqueo duro:** alimentación específica = renal / GI / urinary / aceite. El post `pienso-con-condroprotectores-o-suplemento` dice que **no hay pienso de articulaciones en el catálogo**. No hay saco de mantenimiento que enlazar |
| Inbound blog | Labrador FAQ ya da 280–380 g; las guías de raza hablan de ración. Una calc genérica **canibalizaría** esos posts y la calc renal (misma RER × factor, otra densidad kcal) |
| Contenido único | Bajo respecto a `PiensoRenalCalculator` (70 × peso^0,75 × actividad ÷ kcal/100 g) |
| YMYL | **Alto**. Una «ración normal» invita a usarla como dieta completa sin vet |
| **Por qué no** | Duplicar ingeniería sin productos. Si algún día hay pienso de mantenimiento, se reutiliza el motor renal. No es prioridad |

### 3.5 Calculadora de agua diaria — descartada

| Criterio | Valor |
| --- | --- |
| Query | **0 en GSC** |
| Catálogo | **No hay bebederos ni fuentes** |
| Inbound blog | Menciones puntuales; no hay guía de hidratación |
| Contenido único | Muy bajo (ml/kg trivial) |
| YMYL | **Alto** (deshidratación, enfermedad renal/urinaria — y el sitio vende pienso renal). Dar «X ml/día» al lado de contenido renal es peligroso |
| **Por qué no** | Peor ratio de las cinco |

---

## 4. Otras ideas (GSC / catálogo / blog) — ninguna es «la siguiente»

| Idea | Señal | Por qué no (o no aún) |
| --- | --- | --- |
| Dosis / uso de **aceite de salmón** | Ficha Pets Purest **35 impr. / 6 clics**; blog aceite 21 impr. | 1 solo producto; YMYL de suplemento; «dosis aceite» **no aparece** en el snapshot de queries |
| Talla ThunderShirt / chaleco | Ansiedad con demanda de blog | 1 SKU; sizing por peso es fino; los posts de ansiedad no empujan fuerte a fichas |
| Quiz de **síntomas de ansiedad** | Queries reales de ansiedad | No es el patrón de calculadora; YMYL conductual; el blog ya dice que no hay calc de ansiedad |
| Algo sobre **rasca / pelo** | Mayor clúster no-condro del snapshot | Formato guía (ya rankea). No hay productos de champú/cepillo en catálogo |
| Séptima calc de **talla** (otra cama/bozal) | — | Clúster saturado; primero hacer imprimir las de talla que ya existen |

**Lista explícita de lo que no construir:** edad canina; peso ideal por raza como herramienta; coste anual; ración de mantenimiento sin catálogo; agua diaria; dosis genérica mg/kg de «relajantes»; otra calculadora de talla en un clúster ya cubierto.

---

## 5. Criterio para no acumular medianías

Construir una calculadora **nueva** solo si se cumplen las cuatro:

1. Query demostrable (GSC o demanda clara) que Amazon no responde con una ficha.
2. **≥4–8 productos** de categoría coherente (o plan explícito de ampliar el catálogo *antes*).
3. **≥1 post** que ya imprime (o el pilar se publica a la vez).
4. YMYL manejable con disclaimer honesto, **sin inventar datos clínicos**.

Las cinco ideas fallan en al menos dos de cuatro. Renal y arnés *ya construidas* cumplen 2–4; renal además tiene demanda vía el post de 251 impresiones.

**Ambiguo (no decidido):** si la calc renal está no indexada o indexada a cero. Sin Inspección de URL en GSC no se distingue. Eso no cambia la prioridad: no se abre otra URL hasta resolverlo.

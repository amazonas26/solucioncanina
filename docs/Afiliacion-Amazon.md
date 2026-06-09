# 💸 Afiliación Amazon — por qué "no llegan euros"

> Análisis del 2026-06-09 a partir de los 3 informes de Amazon Associates
> (Tracking ID, Linked Product, Category). Relacionado: [[Informe-2026-06-09]] · [[Dashboard]].

## 🟢 La buena noticia: SÍ hay ingresos (pequeños)

Los informes muestran que **sí se registraron ventas**:

| Métrica | Valor |
|---|---|
| Pedidos reales (items ordered) | **2** |
| Revenue (lo que pagó el comprador) | **80,11 €** |
| **Comisión ganada (Total Earnings)** | **2,94 €** |

Así que el sistema de afiliación **funciona**. Lo que pasa es:

1. **Es muy poco** (2,94 €) — con 2 pedidos no se nota.
2. **Amazon paga tarde**: la comisión se abona **~60 días después de final del mes** en
   que el producto se *envía*. Una venta de junio se cobra hacia finales de agosto.
3. Por eso "no ha llegado ningún euro": ni ha pasado el plazo, ni el importe es relevante aún.

## 🔴 El problema gordo: 939 clics, casi todos FALSOS

El informe de Tracking ID dice **939 clics** en `solucioncanin-21`. Pero:

- La web real solo recibió **~12 clics desde Google** en semanas (Search Console).
- Es **imposible** que usuarios reales generen 939 clics de afiliado.
- En los informes, la mayoría son categoría **"Unknown"** y productos con **título vacío**,
  con **~10 clics por ASIN** de forma uniforme → huella claríssima de **bot/scraper**.

### Causa raíz

Los **propios scripts de scraping** visitan Amazon usando el campo `linkAmazon`, que **lleva
el `?tag=solucioncanin-21`**. Cada vez que corren, Amazon cuenta esas visitas como "clics" de
afiliado:

| Script | Qué hacía | ¿Self-click? |
|---|---|---|
| `update_prices.py` | `session.get(linkAmazon)` | ❌ SÍ (con tag) |
| `fetch_descriptions.py` | `fetch(linkAmazon)` | ❌ SÍ (con tag) |
| `fetch-amazon-images.mjs` | `fetch(linkAmazon)` | ❌ SÍ (con tag) |
| `fetch_reviews.py` | `/dp/{ASIN}/` (sin tag) | ✅ ya era limpio |

98 productos × ~10 ejecuciones ≈ los ~939 clics observados.

### Por qué importa (no es solo estética)

- **Riesgo de BAN**: el Operating Agreement de Amazon Associates **prohíbe** generar clics
  por medios automáticos o hacer clic en tus propios enlaces. Inflar clics con un scraper
  puede **suspender la cuenta y retener las ganancias**. Es el riesgo nº1.
- **Datos inútiles**: con 939 clics-bot, el ratio de conversión real (2 pedidos) queda
  enterrado y no puedes medir qué funciona.

## ✅ El fix aplicado (2026-06-09)

Nuevo helper `amazon_scrape_url()` en `scripts/_common.py` que devuelve la URL **limpia**
para *scrapear* (`https://www.amazon.es/dp/{ASIN}/`, **sin** `?tag=`). Lo usan ahora:

- `update_prices.py`
- `fetch_descriptions.py`
- `fetch-amazon-images.mjs` (equivalente en JS)

> El campo `linkAmazon` del catálogo **mantiene el tag** (es el que ve el usuario en el botón
> "Comprar", y ahí SÍ debe estar). Lo único que cambia es que **el scraper ya no lo usa**.

A partir de ahora, los clics del panel de Amazon deberían ser **solo de usuarios reales**.

## 🧪 Cómo verificarlo

- En **Amazon Associates → Informes**, vigila que los clics bajen drásticamente en los
  próximos días (señal de que ya no hay self-clicks).
- Si el clic de una compra aparece pero no la comisión en 48 h → cookie perdida (navegador
  del comprador, ad-blocker, last-click de otro afiliado). Es del lado del comprador, no del código.

## 📌 Recordatorio

- El comprador debe usar navegador normal (no incógnito), sin ad-blocker, y completar la
  compra sin salir a otra fuente (last-click).
- Añadir al carrito dentro de los 60 s del clic alarga la ventana de atribución a 89 días.

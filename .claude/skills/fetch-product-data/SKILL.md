---
name: fetch-product-data
description: >
  Actualitza automàticament les dades de productes d'una web Astro consultant Amazon.es.
  Llegeix fitxers `src/content/articulos/<slug>/index.json`, extreu l'ASIN del camp `linkAmazon`,
  busca el preu actual, preu original i descompte a Amazon.es via web search, i sobreescriu
  els camps `precio`, `precioOriginal` i `descuentoPct` al JSON.
  Usa aquesta skill sempre que l'usuari vulgui actualitzar preus, estoc o descomptes de productes,
  mencioni "fetch-product", "actualitzar productes", "preus Amazon", o llanci `npm run fetch-product-images`.
---

# Fetch Product Data — Skill

Actualitza els camps de preu i descompte dels productes Astro consultant Amazon.es.

## Estructura del projecte

```
src/content/articulos/
└── <slug>/
    └── index.json   ← fitxer a llegir i sobreescriure
```

### Camps del JSON gestionats per aquesta skill

| Camp | Tipus | Exemple |
|---|---|---|
| `precio` | string `"XX.XX€"` | `"34.99€"` |
| `precioOriginal` | string `"XX.XX€"` o `null` | `"44.99€"` |
| `descuentoPct` | number o `null` | `22` |
| `linkAmazon` | string URL | `"https://www.amazon.es/dp/B01J5RB2J6"` |

> Els camps `nombre`, `descripcion`, `imagen`, `categoria`, `marca` **NO s'han de modificar mai**.

---

## Flux de treball

### 1. Descobrir productes a actualitzar

```bash
# Tots els productes
find src/content/articulos -name "index.json"

# Un producte concret (per slug)
cat src/content/articulos/<slug>/index.json
```

### 2. Extreure l'ASIN

De `linkAmazon`, fes match amb el patró:
```
amazon\.es/dp/([A-Z0-9]{10})
```
Exemple: `https://www.amazon.es/dp/B01J5RB2J6` → ASIN `B01J5RB2J6`

### 3. Consultar Amazon.es

Usa `web_search` amb la query:
```
site:amazon.es <ASIN> precio
```
O directament fes `web_fetch` de la URL del producte:
```
https://www.amazon.es/dp/<ASIN>
```

#### Camps a extreure del resultat

- **`precio`**: preu actual de venda (el que paga el client ara mateix)
- **`precioOriginal`**: preu taixat / "precio recomendado" (si n'hi ha); si no, `null`
- **`descuentoPct`**: percentatge de descompte arrodonit a enter (si no hi ha, `null`)

#### Càlcul del descompte (si Amazon no el mostra explícitament)

```
descuentoPct = round((precioOriginal - precio) / precioOriginal * 100)
```

#### Format dels preus

Sempre string amb € al final, dos decimals, sense espais:
```
"34.99€"   ✓
"34,99 €"  ✗
"34.99"    ✗
```

### 4. Actualitzar el JSON

Llegeix el fitxer, modifica **només** els tres camps de preu, i sobreescriu:

```python
import json, re

path = "src/content/articulos/<slug>/index.json"

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Actualitza només els camps de preu
data["precio"] = "34.99€"
data["precioOriginal"] = "44.99€"   # o None si no n'hi ha
data["descuentoPct"] = 22            # o None si no n'hi ha

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")  # trailing newline per compatibilitat amb git
```

### 5. Resum final

Després d'actualitzar, mostra una taula resum:

| Slug | ASIN | Preu anterior | Preu nou | Descompte |
|------|------|--------------|----------|-----------|
| julius-k9-... | B01J5RB2J6 | 39.99€ | 34.99€ | 22% |

---

## Casos especials

### Producte sense `precioOriginal`
Si Amazon no mostra cap preu taixat:
```json
"precioOriginal": null,
"descuentoPct": null
```

### Producte no disponible / sense estoc
Si el producte apareix com "No disponible" o "Agotado":
- Avisa l'usuari però **no modifiques** el JSON sense confirmació.

### ASIN no trobat o URL trencada
- Avisa l'usuari amb el slug afectat i continua amb la resta.

### Múltiples productes
Quan l'usuari demana actualitzar-los tots, processa'ls en seqüència i mostra el resum global al final.

---

## Exemples de frases que activen aquesta skill

- "Actualitza els preus dels productes"
- "Fes un fetch dels productes"
- "Comprova si han canviat els preus a Amazon"
- "Actualitza el preu del julius-k9"
- `npm run fetch-product-images` (l'usuari menciona que l'ha llançat)
- "Hi ha descomptes nous a Amazon?"

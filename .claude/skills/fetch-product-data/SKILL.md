---
name: fetch-product-data
description: >
  Actualitza les dades dels productes de solucioncanina (preu, ofertes, nota, disponibilitat,
  nom, imatges i descripcions que faltin) des d'Amazon.es amb `scripts/update_prices.py`, i
  resumeix l'informe que genera. Usa aquesta skill sempre que l'usuari vulgui actualitzar preus,
  estoc o descomptes de productes, mencioni "fetch-product", "actualitzar productes",
  "preus Amazon", o llanci `pnpm run fetch-product-images`.
---

# Fetch Product Data — Skill

Tota la lectura d'Amazon la fa `scripts/update_prices.py` (client i parser a
`scripts/amazon.py`): una petició per producte, pauses, reintents i aturada neta si
Amazon respon amb CAPTCHA. **No** consultis Amazon producte a producte amb cerques
web: és més lent, menys fiable i no apunta la data de consulta que mostra la web.

## Flux

1. Python del venv del repo (si no existeix, vegeu `deploy/README.md`):

   ```bash
   .venv/bin/python scripts/update_prices.py --dry-run   # opcional: veure què canviaria
   .venv/bin/python scripts/update_prices.py             # tot el catàleg, ~8-10 min
   .venv/bin/python scripts/update_prices.py --only=<carpeta>   # un sol producte
   ```

   És llarg: llança'l en segon pla i espera que acabi.

2. Llegeix l'informe `scratch/productos/ultimo.md` i resumeix a l'usuari:
   canvis de preu més grans, ofertes noves/acabades, no disponibles i, sobretot,
   la secció **«A revisar»** (decisions editorials: nota baixa, ASIN canviat,
   canvi de preu no confirmat, fitxa desapareguda).

3. Si l'execució surt amb **codi 3**, Amazon ha bloquejat (CAPTCHA): el que s'havia
   llegit ja està desat; proposa tornar-ho a provar d'aquí unes hores. No insisteixis.

4. Compila (`pnpm build`) per validar. **No** facis commit ni deploy si l'usuari no ho demana.

## Què canvia i què no

- Escriu: `precio`, `precioOriginal`/`descuentoPct` (només si Amazon mostra oferta
  coherent), `ventas`, `valoracion`, `valoracionesCount`, `nombre`, i la data a
  `src/data/precios-consultados.json`. `imagen` i `descripcion`, només si falten.
- No disponible o fitxa 404: treu el preu i posa `disponible: false` (la web ho mostra).
- Per defecte **no elimina** res. `--prune` elimina les fitxes que no compleixen
  (nota < 3,7, < 10 valoracions, no disponibles) i crea els 301: només si l'usuari
  ho demana explícitament.
- No toca mai el text editorial (`analisis`, `veredicto`, `pros`, `contras`, `tituloSeo`…).

# 🏠 Solución Canina — Panel de control

> Vault d'Obsidian del projecte. Aquí tens tot el que sabem, ordenat. Obre aquesta nota
> primer i navega amb els enllaços `[[...]]`.

## 📊 Estat actual (resum d'una ullada)

| Àrea | Estat | Detall |
|---|---|---|
| **SEO / visites** | 🟡 creixent lent | Posició mitjana ~41 · 12 clics / 579 impr. (Espanya) · veure [[Informe-2026-06-09]] |
| **Afiliació Amazon** | 🔴 a vigilar | 939 "clics" inflats pels scrapers · **2 comandes reals = 2,94€** · veure [[Afiliacion-Amazon]] |
| **Salut tècnica** | 🟢 bé | build verd, link-checker, redirects, schema · no tocar |
| **Contingut** | 🟢 complet | 98 productes + 20 articles, tots amb contingut editorial |

## 🗂️ Documents

- [[Informe-2026-06-09]] — anàlisi dels 4 informes (Google Search Console + 3 d'Amazon).
- [[Afiliacion-Amazon]] — **per què no arriben euros**: clics falsos dels scripts + el fix.
- [[AUDITORIA-SEO]] — auditoria SEO completa i registre de tots els canvis (document viu).
- [[PLAN-BACKLINKS]] — pla d'autoritat / backlinks (feina off-site) amb textos a punt.

## ✅ El que JA FUNCIONA (no tocar)

- Pàgines que reben clics: **home** (12% CTR), **bravia** (pos 2,25), **longevia** (pos 6,9), **correes**.
- Infra: sitemap amb lastmod, schema/rich snippets, canonical www, redirects 301, cache headers.
- **Comprovador d'enllaços al build** (`scripts/astro-internal-link-check.mjs`) → cap 404 intern.
- **Orquestrador** `scripts/update.sh` (etapes prices/new/content/build).
- Contingut editorial dels 98 productes (millor que el que genera l'LLM local 3b).

## 🔴 El que FALLA / a millorar

1. **Clics d'afiliat falsos** (els scrapers visiten Amazon amb `?tag=`). → [[Afiliacion-Amazon]] *(FIX aplicat)*.
2. **URLs antigues/duplicades** encara indexades a Google (no-www + slugs vells) → es resol amb temps + reindexació.
3. **Clúster "condroprotectores" a posició ~70** → la palanca real és autoritat: [[PLAN-BACKLINKS]].

## 🧭 Següents passos

- [ ] Desplegar l'últim commit a Vercel.
- [ ] Search Console: reindexar home + `/categoria/condroprotectores/` + productes top.
- [ ] Executar el pla de backlinks ([[PLAN-BACKLINKS]]).
- [ ] D'aquí uns dies, tornar a exportar GSC + Amazon i comparar a [[Informe-2026-06-09]].

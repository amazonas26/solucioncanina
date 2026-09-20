# 🔍 Auditoria SEO — solucioncanina.es

> Document viu. Font de dades: export de Google Search Console **"Performance on Search"**
> del 2026-06-05 (filtre "últims 3 mesos", però amb dades reals només des del **12 maig 2026**).
> Anem marcant `[x]` a mesura que arreglem les coses.

---

## 🩺 Diagnòstic

El web **no està trencat**. El problema és que és **pràcticament nou** (~3 setmanes de
vida real a Google) i ranqueja a la **pàgina 4-7** (posició mitjana **~45**). Surt a les
cerques però tan avall que gairebé ningú clica.

**Hi ha demanda real i el target és correcte** (88% de les impressions són d'Espanya).
Falta **autoritat, optimització de les pàgines comercials i temps**.

### Números del període (12 maig – 1 juny 2026)

| Mètrica | Valor | Lectura |
|---|---|---|
| Impressions | 531 | Google ja t'ensenya |
| Clics | 11 | Quasi ningú clica |
| CTR mitjà | ~2,1% | Baix per culpa de la posició |
| **Posició mitjana** | **~45** | 🔴 El problema central: pàgina 4-5 |
| Espanya | 470 impr. / 11 clics | ✅ Tot el tràfic útil ve d'Espanya |
| Mòbil vs Escriptori (pos.) | 34,3 vs 51,9 | Ranquem millor a mòbil |

**Tendència positiva:** la posició mitjana ha passat de ~65 (mitjans de maig) a **8,8 l'1 de
juny**. Va pel bon camí; cal volum i temps.

---

## ✅ El que ja està BÉ (no tocar)

- [x] Canonicalització **www** — `astro.config.mjs` (`site`) + 301 no-www→www a nginx (`deploy/nginx/solucioncanina.conf`).
- [x] **Sitemap** amb `lastmod` real i prioritats — `astro.config.mjs`.
- [x] **Rich snippets** funcionen — Google ja mostra Product snippets (182 impr.) i Review snippets.
- [x] **URLs netes** amb 301 des de les antigues llargues — nginx (`deploy/nginx/redirects.conf`).
- [x] robots.txt, cache headers i sitemap declarat correctes.

---

## 🔴 Problemes que frenen les visites

### P0 — 🚨 56 enllaços interns TRENCATS al blog (el més greu) ✅ 50/55 resolts
Gairebé tots els 16 articles enllaçaven productes amb **slugs antics** (de la migració):
l'usuari que arribava de Google llegia la guia, clicava per comprar i topava amb un **404**.
És la principal fuita de **conversió + SEO** (crawl budget malgastat, cap autoritat als productes).
- ✅ **50 corregits** automàticament i verificats (49 a productes per coincidència exacta de
  carpeta→slug real + 1 enllaç blog→blog).
- ⏳ **5 pendents**: apunten a **productes que no són al catàleg** (oli de salmó GreenPet/Pets
  Purest, Zesty Paws Calming, PetSafe Rampa Telescópica) → requereixen decisió editorial
  (afegir producte / reapuntar a alternativa real / enllaçar a categoria / treure l'enllaç).

### P1 — Migració d'URLs recent: Google encara reprocessa (transitori)
L'URL antiga `perrocondroprotector-…` encara acumula **115 impressions a posició 71** tot i
fer 301. Es resol sol, però es pot accelerar sol·licitant indexació.

### P2 — La pàgina més rendible ranqueja a la posició 57
Tota la demanda es concentra en **condroprotectores**:

| Query | Impr. | Posició | Clics |
|---|---|---|---|
| condroprotector perros | 46 | 70 | 0 |
| condroprotectores para perros | 33 | 72 | 0 |
| condroprotectores perros | 32 | 73 | 0 |
| *(+ ~10 variants)* | ~150 | 60-80 | 0 |

`/categoria/condroprotectores/` → 104 impressions, posició **57**, 0 clics.
**És la pàgina nº1 a optimitzar.**

### P3 — On ranquem bé, el títol no convenç (CTR baix)
`/blog/condroprotectores-perros-guia-completa/` → posició **8,3**, 54 impressions, però només
**1,85% CTR** (hauria de ser 3-5%). Títol/meta-description poc atractius.

---

## 🎯 Pla d'acció (anem marcant)

### Impacte ràpid (aquest mes)
- [x] **F1a.** Infraestructura de títols-SEO al blog: nou camp `tituloSeo`/`descripcionSeo`
      + eliminat el doble sufix `| Blog | Solución Canina` (millora els 16 articles). ✅ 2026-06-05
- [x] **F1b.** Títol-SEO optimitzat del post de condroprotectores
      (`Condroprotectores para perros: cuáles funcionan | Solución Canina`, 65 car.). ✅ 2026-06-05
- [x] **F1c.** Títol-SEO de la **home** → keyword-first:
      `Condroprotectores y camas ortopédicas para perros | Solución Canina`. ✅ 2026-06-05
- [x] **F2.** Reforçada `/categoria/condroprotectores/`: títol+meta-description SEO propis
      (`Condroprotectores para perros: comparativa y precios`) apuntant a la query real, i
      enllaç intern contextual blog→categoria (la home ja hi enllaçava). ✅ 2026-06-05
- [ ] **F3.** A Search Console: "Inspeccionar URL" + "Sol·licitar indexació" de la categoria
      condroprotectores i dels 5 productes top (accelera el reprocessament post-migració). *(acció manual)*
- [x] **F4.** Títols+meta SEO propis per a **les 7 categories** + **productes**: nou `tituloSeo`/
      `descripcionSeo` a l'esquema de productes, títol curt automàtic (trunca els noms d'Amazon
      llargs que Google tallava) i `tituloSeo` fet a mà als 4 productes top amb nom llarg
      (bravia, jointsure, maikai, glucosamina-condroitina 180). ✅ 2026-06-05

### Continu (mou l'agulla a llarg termini)
- [x] **F5.** Contingut: nou article **"Mejores correas largas para perros: adiestramiento, paseo
      y rastreo"** (`/blog/mejores-correas-largas-perros-adiestramiento/`), atacant el clúster
      *correa larga* (demanda real al informe: "correas largas para perros grandes" pos 1, "correa
      20 metros perro" amb clic). Taula de 7 productes reals + enllaços a `/categoria/correas/`. ✅ 2026-06-06
      *(Continu: 1-2 articles bons/mes — propers candidats: bozales, biothane, canicross.)*
- [~] **F6.** Backlinks / autoritat: **pla lliurat** a [PLAN-BACKLINKS.md](PLAN-BACKLINKS.md)
      (perfils de marca, Pinterest, directoris, guest posts, linkable asset, + textos a punt).
      Execució **off-site per l'usuari** — és l'única palanca per pujar de la posició 45.
- [ ] **F7.** Constància i paciència: amb 3 setmanes de vida la tendència ja és bona.

---

## 📌 Oportunitats secundàries (de les dades)
- **Camas ortopédicas**: `cama ortopedica perro` i variants ~30 impr., posicions 39-78 → categoria a reforçar.
- **Pienso renal**: blog `pienso-renal-perros-guia` posició 24 amb 17 impr. → pot pujar amb enllaços interns.
- **Correas largas**: alguns productes ja ranquen molt bé (posició 1-10) però amb poques impressions → ampliar gamma de contingut.
- **Soroll internacional** (Índia, Vietnam…): impressions irrellevants, ignorar.

---

## 📓 Registre de canvis
<!-- Anem afegint aquí cada fix amb data i commit -->
- **2026-06-05 — F1a/F1b (títols-SEO del blog):**
  - `src/content/config.ts`: afegits camps opcionals `tituloSeo` i `descripcionSeo` al blog.
  - `src/pages/blog/[slug].astro`: títol passa a `tituloSeo ?? titulo` i descripció a
    `descripcionSeo ?? descripcion`; eliminat el sufix redundant `| Blog`.
  - `…/condroprotectores-perros-guia-completa/index.mdx`: afegit `tituloSeo` curt optimitzat.
  - Build OK (238 pàgines). Pendent: desplegar + sol·licitar reindexació a Search Console.
- **2026-06-05 — F1c (títol home):** `src/pages/index.astro` → títol keyword-first
  `Condroprotectores y camas ortopédicas para perros | Solución Canina`. Build OK.
- **2026-06-05 — P0 (enllaços trencats):** detectats 56 enllaços interns 404 a 16 articles.
  - 10 al post de condroprotectores + 39 a la resta + 1 blog→blog → **50 corregits** (mapeig
    determinista carpeta→slug real via resolutor `/tmp/resolve_links.mjs`). Build OK (238 pàg.).
  - Pendents 5 (productes inexistents al catàleg) → **decisió de l'usuari**.
  - TODO recomanat: afegir un **comprovador d'enllaços interns** al build per evitar regressions.
- **2026-06-05 — P0 (reapuntaments editorials):** resolts 3 dels 5 pendents:
  - Zesty Paws Calming (×2) → **Multiva Calming** (`/producto/multiva-calming-medium-large-25-masticables`),
    canviant també el nom al text (`ansiedad-separacion-perros-guia`, `miedo-petardos-perros-soluciones`).
  - PetSafe Rampa Telescópica → **Rampa metálica Nobleza**, corregint la spec falsa de 180 kg → 110 kg
    reals (`rampas-para-perros-beneficios`). Build OK.
  - **Estat P0: 53/56 resolts.** Queden 3 (oli de salmó) → cal crear els productes al catàleg.
- **2026-06-05 — F2 + F4 (SEO de categories):** `src/utils/problemSections.ts` → nou mapa
  `categorySeo` + `getCategorySeo()` amb títol i meta-description propis per a les 7 categories
  reals; `src/pages/categoria/[slug].astro` els aplica (l'H1 visible no canvia). Afegit enllaç
  intern contextual blog→`/categoria/condroprotectores/`. Build OK (238 pàg.), 0 enllaços
  trencats nous (només resten els 3 de salmó).
- **2026-06-05 — Comprovador d'enllaços al build:** `scripts/astro-internal-link-check.mjs`
  (integració Astro `astro:build:done` + CLI). Escaneja tot el dist (6.708 enllaços, 238 pàg.)
  i **falla el build** si n'hi ha cap de trencat; allowlist documentat per als 2 de salmó.
  Provat en positiu i negatiu.
- **2026-06-05 — F4 productes:** `src/content/config.ts` (camps `tituloSeo`/`descripcionSeo`),
  `src/pages/producto/[slug].astro` (títol curt automàtic + ús dels camps) i `tituloSeo` a 4
  productes top. Build OK, comprovador verd.
- **2026-06-05 — Reparador d'enllaços reutilitzable:** `scripts/fix-internal-links.mjs`
  (dry-run / `--apply`) que mapeja slugs trencats → producte real (carpeta-exacta + tokens).
- **2026-06-05 — Redirect del producte esborrat (informe):** `co-z-rampa…` rankejava a la
  posició 9 amb 1 clic però s'havia eliminat → 301 a `/categoria/subir-al-coche-o-sofa` a
  nginx (`deploy/nginx/redirects.conf`; abans `vercel.json`) per no perdre aquest tràfic.
- **2026-06-05 — Verificació integral:** build 238 pàg. OK · 6.708 enllaços interns, 0 trencats ·
  sitemap 135 URLs (sense co-z) · 0 títols amb marca duplicada · 0 amb `| Blog` · imatges
  esborrades són orfes (cap referència trencada).
- **2026-06-05 — Deploy verificat en viu:** desplegat per l'usuari; `curl` confirma títols nous
  (home + categoria), enllaç de producte abans trencat → 200, i redirect co-z → 308.
- **2026-06-06 — F5 (contingut):** nou article de correes llargues (build 239 pàg., 7 enllaços
  de producte verificats pel comprovador). Reutilitza imatge existent de correes (es pot
  substituir per una pròpia més endavant).
- **2026-06-06 — F6 (autoritat):** lliurat `PLAN-BACKLINKS.md` amb pla i textos a punt.
- **2026-06-06 — Revisió i millora dels scripts:** verificat que TOTS els scripts de dades
  (`update_prices`, `fetch-amazon-images`, `assign-primary-section`, …) preserven els camps
  nous `tituloSeo`/`descripcionSeo` (test de round-trip OK). Millorats els 2 scripts propis:
  el comprovador ara valida també els **destins dels redirects** de `vercel.json` (espejo; els 301 vius són nginx), i el reparador
  cobreix també enllaços **/blog/**. Provats positiu+negatiu; build verd (239 pàg., 15 redirects).
- **2026-06-06 — Orquestrador `scripts/update.sh`:** encadena els scripts existents per etapes
  (`prices`/`new`/`images`/`descriptions`/`content`/`maintenance`/`build`/`all`) sense barrejar
  el barat-freqüent amb el car-LLM ni el destructiu. Opcions `--plan` (només imprimeix), `--dry-run`,
  `--yes`, `--refill` (= `update_prices --refill-deleted`). Confirmació abans del destructiu/car,
  i **build final com a gate** (el comprovador detecta si una poda ha deixat enllaços trencats).
  Provat amb `--plan` i guards de seguretat.

// Reparador d'enllaços interns del blog (productes i articles).
//
// Complementa scripts/astro-internal-link-check.mjs: aquell DETECTA enllaços trencats i
// atura el build; aquest els REPARA. Quan una migració d'slugs deixa enllaços `/producto/<slug>`
// o `/blog/<slug>` trencats al cos dels articles, mapeja cada slug trencat al destí real.
//
// Estratègia de mapeig, per ordre de confiança:
//   1) dir-exact  → el slug trencat coincideix amb el NOM DE CARPETA d'un producte; s'usa el seu
//                   slug real (data.slug || slugify(nombre)). Confiança 1.0 (és el mateix ítem).
//   2) token      → màxima coincidència de tokens (Jaccard) amb un ítem candidat. Confiança < 1.
// Per defecte fa DRY-RUN. Amb --apply corregeix només les coincidències de confiança ≥ llindar
// (0.5 per defecte), respectant límits de paraula per no fer matches parcials.
//
// Ús:
//   node scripts/fix-internal-links.mjs              # dry-run, mostra propostes
//   node scripts/fix-internal-links.mjs --apply      # aplica les de confiança alta
//   node scripts/fix-internal-links.mjs --min 0.6    # ajusta el llindar

import fs from 'node:fs';
import path from 'node:path';

const ART = 'src/content/articulos';
const BLOG = 'src/content/blog';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const MIN = (() => {
  const i = args.indexOf('--min');
  return i >= 0 && args[i + 1] ? parseFloat(args[i + 1]) : 0.5;
})();

// Ha de coincidir amb src/utils/slugify.ts
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

const tokenize = (s) => new Set(slugify(s).split('-').filter((t) => t.length > 2));

// Construeix un "espai" de candidats per a un tipus d'enllaç (/producto/ o /blog/):
//   validSlugs: Set d'slugs vàlids · dirToSlug: Map nom-carpeta → slug real · tokens per fuzzy.
function buildSpace({ base, prefix, slugOf, textOf }) {
  const validSlugs = new Set();
  const dirToSlug = new Map();
  const tokens = [];
  if (!fs.existsSync(base)) return { prefix, validSlugs, dirToSlug, tokens };
  for (const dir of fs.readdirSync(base, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const data = slugOf(dir.name);
    if (!data) continue;
    validSlugs.add(data.slug);
    dirToSlug.set(dir.name, data.slug);
    tokens.push({ slug: data.slug, toks: tokenize(data.slug + '-' + (data.text || '')) });
  }
  return { prefix, validSlugs, dirToSlug, tokens };
}

// Espai de productes: slug = data.slug || slugify(nombre)
const productSpace = buildSpace({
  base: ART, prefix: '/producto/',
  slugOf(dir) {
    const jp = path.join(ART, dir, 'index.json');
    if (!fs.existsSync(jp)) return null;
    let d; try { d = JSON.parse(fs.readFileSync(jp, 'utf8')); } catch { return null; }
    return { slug: d.slug || slugify(d.nombre || dir), text: d.nombre || '' };
  },
});

// Espai de blog: el slug ÉS el nom de la carpeta
const blogSpace = buildSpace({
  base: BLOG, prefix: '/blog/',
  slugOf(dir) { return { slug: dir, text: dir.replace(/-/g, ' ') }; },
});

const SPACES = [productSpace, blogSpace];

function bestMatch(space, brokenSlug) {
  const bt = tokenize(brokenSlug);
  let best = null, score = 0;
  for (const c of space.tokens) {
    let inter = 0;
    for (const t of bt) if (c.toks.has(t)) inter++;
    const j = inter / (bt.size + c.toks.size - inter || 1);
    if (j > score) { score = j; best = c; }
  }
  return { target: best?.slug ?? null, score };
}

// Recull enllaços trencats al cos dels articles, per a cada espai.
const postFiles = new Map();
const broken = new Map(); // `${prefix}${slug}` -> { space, slug, posts:Set }
if (fs.existsSync(BLOG)) {
  for (const dir of fs.readdirSync(BLOG, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const fp = path.join(BLOG, dir.name, 'index.mdx');
    if (!fs.existsSync(fp)) continue;
    postFiles.set(dir.name, fp);
    const txt = fs.readFileSync(fp, 'utf8');
    for (const space of SPACES) {
      const re = new RegExp(space.prefix.replace('/', '\\/') + '[a-z0-9-]+', 'g');
      for (const m of txt.match(re) || []) {
        const slug = m.slice(space.prefix.length);
        if (space.validSlugs.has(slug)) continue;
        const key = space.prefix + slug;
        if (!broken.has(key)) broken.set(key, { space, slug, posts: new Set() });
        broken.get(key).posts.add(dir.name);
      }
    }
  }
}

// Resol + (opcional) aplica
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const resolved = [], unresolved = [];
for (const [, { space, slug, posts }] of [...broken].sort()) {
  let target, how, conf;
  if (space.dirToSlug.has(slug)) { target = space.dirToSlug.get(slug); how = 'dir-exact'; conf = 1; }
  else { const r = bestMatch(space, slug); target = r.target; how = `token ${r.score.toFixed(2)}`; conf = r.score; }
  const row = { prefix: space.prefix, slug, target, how, conf, posts: [...posts] };
  (conf >= MIN ? resolved : unresolved).push(row);
}

console.log(`\nProductes: ${productSpace.validSlugs.size} | articles: ${blogSpace.validSlugs.size} | enllaços trencats: ${broken.size} | llindar: ${MIN} | mode: ${APPLY ? 'APPLY' : 'dry-run'}\n`);
console.log(`== Resoluble (confiança ≥ ${MIN}) — ${resolved.length} ==`);
for (const r of resolved) console.log(`  [${r.how}] ${r.prefix}${r.slug}\n        → ${r.prefix}${r.target}   (${r.posts.join(', ')})`);
console.log(`\n== A revisar manualment (confiança < ${MIN}) — ${unresolved.length} ==`);
for (const r of unresolved) console.log(`  ${r.prefix}${r.slug}   (${r.posts.join(', ')})  — millor proposta: ${r.target ? r.prefix + r.target : 'cap'} [${r.how}]`);

if (APPLY && resolved.length) {
  let n = 0;
  const byPost = new Map();
  for (const r of resolved) for (const p of r.posts) (byPost.get(p) ?? byPost.set(p, []).get(p)).push(r);
  for (const [post, rows] of byPost) {
    const fp = postFiles.get(post);
    let txt = fs.readFileSync(fp, 'utf8');
    rows.sort((a, b) => b.slug.length - a.slug.length); // slugs llargs primer
    for (const r of rows) {
      const re = new RegExp(esc(r.prefix + r.slug) + '(?![a-z0-9-])', 'g');
      const m = txt.match(re);
      if (m) { txt = txt.replace(re, r.prefix + r.target); n += m.length; }
    }
    fs.writeFileSync(fp, txt);
  }
  console.log(`\n✅ Aplicades ${n} correccions a ${byPost.size} articles.`);
} else if (!APPLY) {
  console.log(`\n(dry-run: afegeix --apply per corregir les ${resolved.length} resolubles)`);
}

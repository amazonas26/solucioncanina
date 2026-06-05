// Reparador d'enllaços interns de producte al blog.
//
// Complementa scripts/astro-internal-link-check.mjs: aquell DETECTA enllaços trencats i
// atura el build; aquest els REPARA. Quan una migració d'slugs deixa enllaços `/producto/<slug>`
// trencats al blog, mapeja cada slug trencat al producte real i (amb --apply) ho corregeix.
//
// Estratègia de mapeig, per ordre de confiança:
//   1) dir-exact  → el slug trencat coincideix amb el NOM DE CARPETA d'un producte; s'usa el seu
//                   slug real (data.slug || slugify(nombre)). Confiança 1.0 (és el mateix producte).
//   2) token      → màxima coincidència de tokens (Jaccard) amb un producte. Confiança < 1.
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

// 1) Índex de productes
const dirToSlug = new Map();
const validSlugs = new Set();
const productTokens = [];
const tokenize = (s) => new Set(slugify(s).split('-').filter((t) => t.length > 2));
for (const dir of fs.readdirSync(ART, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const jp = path.join(ART, dir.name, 'index.json');
  if (!fs.existsSync(jp)) continue;
  let d;
  try { d = JSON.parse(fs.readFileSync(jp, 'utf8')); } catch { continue; }
  const slug = d.slug || slugify(d.nombre || dir.name);
  dirToSlug.set(dir.name, slug);
  validSlugs.add(slug);
  productTokens.push({ slug, toks: tokenize(slug + '-' + (d.nombre || '')) });
}

function bestMatch(brokenSlug) {
  const bt = tokenize(brokenSlug);
  let best = null, score = 0;
  for (const p of productTokens) {
    let inter = 0;
    for (const t of bt) if (p.toks.has(t)) inter++;
    const j = inter / (bt.size + p.toks.size - inter || 1);
    if (j > score) { score = j; best = p; }
  }
  return { target: best?.slug ?? null, score };
}

// 2) Enllaços trencats al blog
const broken = new Map(); // slug -> Set(posts)
const postFiles = new Map(); // post -> filepath
for (const dir of fs.readdirSync(BLOG, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const fp = path.join(BLOG, dir.name, 'index.mdx');
  if (!fs.existsSync(fp)) continue;
  postFiles.set(dir.name, fp);
  const txt = fs.readFileSync(fp, 'utf8');
  for (const m of txt.match(/\/producto\/[a-z0-9-]+/g) || []) {
    const slug = m.replace('/producto/', '');
    if (validSlugs.has(slug)) continue;
    if (!broken.has(slug)) broken.set(slug, new Set());
    broken.get(slug).add(dir.name);
  }
}

// 3) Resol + (opcional) aplica
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const resolved = [], unresolved = [];
for (const [slug, posts] of [...broken].sort()) {
  let target, how, conf;
  if (dirToSlug.has(slug)) { target = dirToSlug.get(slug); how = 'dir-exact'; conf = 1; }
  else { const r = bestMatch(slug); target = r.target; how = `token ${r.score.toFixed(2)}`; conf = r.score; }
  const row = { slug, target, how, conf, posts: [...posts] };
  (conf >= MIN ? resolved : unresolved).push(row);
}

console.log(`\nProductes: ${validSlugs.size} | enllaços trencats: ${broken.size} | llindar: ${MIN} | mode: ${APPLY ? 'APPLY' : 'dry-run'}\n`);
console.log(`== Resoluble (confiança ≥ ${MIN}) — ${resolved.length} ==`);
for (const r of resolved) console.log(`  [${r.how}] /producto/${r.slug}\n        → /producto/${r.target}   (${r.posts.join(', ')})`);
console.log(`\n== A revisar manualment (confiança < ${MIN}) — ${unresolved.length} ==`);
for (const r of unresolved) console.log(`  /producto/${r.slug}   (${r.posts.join(', ')})  — millor proposta: ${r.target ? '/producto/' + r.target : 'cap'} [${r.how}]`);

if (APPLY && resolved.length) {
  let n = 0;
  const byPost = new Map();
  for (const r of resolved) for (const p of r.posts) (byPost.get(p) ?? byPost.set(p, []).get(p)).push(r);
  for (const [post, rows] of byPost) {
    const fp = postFiles.get(post);
    let txt = fs.readFileSync(fp, 'utf8');
    rows.sort((a, b) => b.slug.length - a.slug.length); // slugs llargs primer
    for (const r of rows) {
      const re = new RegExp('/producto/' + esc(r.slug) + '(?![a-z0-9-])', 'g');
      const m = txt.match(re);
      if (m) { txt = txt.replace(re, '/producto/' + r.target); n += m.length; }
    }
    fs.writeFileSync(fp, txt);
  }
  console.log(`\n✅ Aplicades ${n} correccions a ${byPost.size} articles.`);
} else if (!APPLY) {
  console.log(`\n(dry-run: afegeix --apply per corregir les ${resolved.length} resolubles)`);
}

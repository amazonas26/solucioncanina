// Comprovador d'enllaços interns per al build d'Astro.
//
// Per què: una migració d'slugs va deixar 56 enllaços interns trencats (404) repartits
// pel blog — la principal fuita de conversió/SEO del lloc. Aquesta integració evita que
// torni a passar: escaneja TOT el dist (pàgines i assets) i FALLA el build si troba
// qualsevol enllaç intern (href/src començant per "/") que no resol a un fitxer real.
// A més valida que els DESTINS interns dels redirects de vercel.json també existeixin
// (un redirect cap a un 404 és un bug silenciós).
//
// S'executa dins `astro build` (hook astro:build:done), així que protegeix el
// desplegament estàtic al VPS. També es pot executar com a CLI: `node scripts/astro-internal-link-check.mjs [distDir]`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Enllaços interns coneguts i pendents (productes encara no creats al catàleg).
// Documentar aquí qualsevol excepció temporal i eliminar-la quan es resolgui.
const ALLOWLIST = new Set([
  // (buida) Els productes d'oli de salmó ja existeixen al catàleg.
]);

const inAllowlist = (link) => ALLOWLIST.has(link) || ALLOWLIST.has(link.replace(/\/$/, ''));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Extreu rutes internes de href="/..." i src="/..." (ignora //, http(s), mailto, tel, #, data:)
function extractInternalLinks(html) {
  const links = new Set();
  const re = /(?:href|src)\s*=\s*["'](\/[^"'#]*)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    if (href.startsWith('//')) continue;
    href = href.split('?')[0].split('#')[0];
    if (href) links.add(href);
  }
  return links;
}

// Resol una ruta interna contra el dist. Retorna true si existeix el destí.
function resolves(distDir, pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { p = pathname; }
  const abs = path.join(distDir, p);
  if (p === '/') return fs.existsSync(path.join(distDir, 'index.html'));
  if (p.endsWith('/')) return fs.existsSync(path.join(abs, 'index.html'));
  const last = p.split('/').pop() || '';
  if (last.includes('.')) return fs.existsSync(abs); // asset amb extensió (imatge, xml, txt…)
  // ruta neta sense barra final: pot ser /x/index.html o /x.html
  return fs.existsSync(path.join(abs, 'index.html')) || fs.existsSync(abs + '.html');
}

// Comprova els enllaços interns de totes les pàgines del dist.
export function checkInternalLinks(distDir, { logger } = {}) {
  const log = logger ?? console;
  if (!fs.existsSync(distDir)) {
    (log.warn ?? log.info)(`[link-check] dist no trobat: ${distDir} (saltat)`);
    return { broken: [], checked: 0 };
  }
  const files = walk(distDir);
  const brokenByLink = new Map();
  let linkOccurrences = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const page = '/' + path.relative(distDir, file).replace(/index\.html$/, '').replace(/\\/g, '/');
    for (const link of extractInternalLinks(html)) {
      linkOccurrences++;
      if (inAllowlist(link)) continue;
      if (!resolves(distDir, link)) {
        if (!brokenByLink.has(link)) brokenByLink.set(link, new Set());
        brokenByLink.get(link).add(page);
      }
    }
  }
  const broken = [...brokenByLink.entries()].map(([link, pages]) => ({ link, pages: [...pages] }));
  log.info(`[link-check] ${files.length} pàgines, ${linkOccurrences} enllaços interns comprovats, ${ALLOWLIST.size} a l'allowlist.`);
  if (broken.length) {
    log.error(`[link-check] ❌ ${broken.length} enllaços interns TRENCATS:`);
    for (const b of broken.sort((a, z) => a.link.localeCompare(z.link))) {
      log.error(`  ${b.link}\n      a: ${b.pages.slice(0, 6).join(', ')}${b.pages.length > 6 ? ` (+${b.pages.length - 6})` : ''}`);
    }
  } else {
    log.info('[link-check] ✅ cap enllaç intern trencat.');
  }
  return { broken, checked: linkOccurrences };
}

// Valida que els destins INTERNS dels redirects de vercel.json existeixin al dist.
// (Els destins externs https:// i el redirect catch-all no-www→www s'ignoren.)
export function checkRedirectDestinations(distDir, { logger, vercelJsonPath = 'vercel.json' } = {}) {
  const log = logger ?? console;
  if (!fs.existsSync(vercelJsonPath)) return { broken: [], checked: 0 };
  let redirects = [];
  try { redirects = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8')).redirects ?? []; }
  catch { (log.warn ?? log.info)('[link-check] vercel.json no s\'ha pogut llegir (saltat).'); return { broken: [], checked: 0 }; }

  const broken = [];
  let checked = 0;
  for (const r of redirects) {
    const dest = r?.destination;
    if (typeof dest !== 'string' || !dest.startsWith('/')) continue; // ignora externs ($1, https…)
    if (dest.includes('$')) continue; // patró dinàmic
    checked++;
    const clean = dest.split('?')[0].split('#')[0];
    if (inAllowlist(clean)) continue;
    if (!resolves(distDir, clean)) broken.push({ source: r.source, destination: dest });
  }
  log.info(`[link-check] ${checked} destins de redirect interns comprovats.`);
  if (broken.length) {
    log.error(`[link-check] ❌ ${broken.length} redirects apunten a un destí inexistent:`);
    for (const b of broken) log.error(`  ${b.source}\n      → ${b.destination} (no existeix)`);
  }
  return { broken, checked };
}

// Integració Astro: executa les dues comprovacions i atura el build si n'hi ha cap de trencada.
export default function internalLinkCheck() {
  return {
    name: 'internal-link-check',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const links = checkInternalLinks(distDir, { logger });
        const redirects = checkRedirectDestinations(distDir, { logger });
        const total = links.broken.length + redirects.broken.length;
        if (total) {
          throw new Error(`[link-check] Build aturat: ${links.broken.length} enllaços + ${redirects.broken.length} redirects trencats (detall a dalt).`);
        }
      },
    },
  };
}

// Execució com a CLI directa
if (import.meta.url === `file://${process.argv[1]}`) {
  const distDir = path.resolve(process.argv[2] || 'dist');
  const links = checkInternalLinks(distDir);
  const redirects = checkRedirectDestinations(distDir);
  process.exit(links.broken.length + redirects.broken.length ? 1 : 0);
}

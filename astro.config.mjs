import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import internalLinkCheck from './scripts/astro-internal-link-check.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve('.');

// Precompute lastmod map: URL path → ISO date. Robust: failures don't break the build.
const lastmodMap = new Map();
function safeStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}

// Data de l'últim commit de cada fitxer. El mtime no serveix: un clone o checkout
// posa tots els fitxers a l'hora actual i el sitemap marcava totes les URL com a
// modificades el dia del build. Fitxers amb canvis sense commit (o sense git) → mtime.
const gitDates = new Map();
const dirtyFiles = new Set();
try {
  const git = (args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  });
  let commitIso = null;
  for (const line of git(['log', '--format=%x00%cI', '--name-only', '--no-renames']).split('\n')) {
    if (line.startsWith('\0')) { commitIso = new Date(line.slice(1)).toISOString(); continue; }
    if (line && commitIso && !gitDates.has(line)) gitDates.set(line, commitIso);
  }
  const dirty = git(['diff', '--name-only', 'HEAD']) + git(['ls-files', '--others', '--exclude-standard']);
  for (const f of dirty.split('\n')) if (f) dirtyFiles.add(f);
} catch {
  // Sense git (o error a mig camí): tot cau a mtime, mai dates de commit a mitges.
  gitDates.clear();
}

function fileIso(p) {
  const rel = path.relative(ROOT, p).split(path.sep).join('/');
  if (!dirtyFiles.has(rel) && gitDates.has(rel)) return gitDates.get(rel);
  const st = safeStat(p);
  return st ? st.mtime.toISOString() : null;
}
function latestIso(files) {
  let max = null;
  for (const p of files) {
    const iso = fileIso(p);
    if (iso && (!max || iso > max)) max = iso;
  }
  return max;
}
function bumpLastmod(urlPath, iso) {
  if (!iso) return;
  const prev = lastmodMap.get(urlPath);
  if (!prev || iso > prev) lastmodMap.set(urlPath, iso);
}
function setLastmod(urlPath, ...files) {
  bumpLastmod(urlPath, latestIso(files.flat()));
}
function slugifyLike(text) {
  // Must match src/utils/slugify.ts
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

const pagesDir = path.join(ROOT, 'src/pages');
const articulosDir = path.join(ROOT, 'src/content/articulos');
const blogDir = path.join(ROOT, 'src/content/blog');
const problemSectionsFile = path.join(ROOT, 'src/utils/problemSections.ts');
const herramientasFile = path.join(ROOT, 'src/utils/herramientas.ts');
const categoriaTpl = path.join(pagesDir, 'categoria', '[slug].astro');
const productoTpl = path.join(pagesDir, 'producto', '[slug].astro');
const blogTpl = path.join(pagesDir, 'blog', '[slug].astro');

const categoryMaxMtime = new Map(); // categorySlug → ISO date (la més recent)
// Fitxes «Pendiente» (sense anàlisi): noindex a la plantilla i fora del sitemap.
const noindexProductPaths = new Set();
let latestProductIso = null;
let latestBlogIso = null;
try {
  if (fs.existsSync(articulosDir)) {
    for (const entry of fs.readdirSync(articulosDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const jsonPath = path.join(articulosDir, entry.name, 'index.json');
      const st = safeStat(jsonPath);
      if (!st) continue;
      let data = {};
      try { data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch { continue; }
      const slug = data.slug || (data.nombre ? slugifyLike(data.nombre) : entry.name);
      if (data.tipoAnalisis === 'Pendiente') noindexProductPaths.add(`/producto/${slug}/`);
      const iso = fileIso(jsonPath);
      setLastmod(`/producto/${slug}/`, jsonPath, productoTpl);
      if (!latestProductIso || iso > latestProductIso) latestProductIso = iso;
      if (data.categoria) {
        const catSlug = slugifyLike(data.categoria);
        const prev = categoryMaxMtime.get(catSlug);
        if (!prev || iso > prev) categoryMaxMtime.set(catSlug, iso);
      }
    }
  }
} catch { /* noop */ }
for (const [catSlug, iso] of categoryMaxMtime) {
  lastmodMap.set(`/categoria/${catSlug}/`, iso);
  setLastmod(`/categoria/${catSlug}/`, categoriaTpl, problemSectionsFile);
}
try {
  if (fs.existsSync(blogDir)) {
    for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const mdxPath = path.join(blogDir, entry.name, 'index.mdx');
      const mdPath = path.join(blogDir, entry.name, 'index.md');
      const contentFile = safeStat(mdxPath) ? mdxPath : mdPath;
      const st = safeStat(contentFile);
      if (!st) continue;
      const iso = fileIso(contentFile);
      setLastmod(`/blog/${entry.name}/`, contentFile, blogTpl);
      if (!latestBlogIso || iso > latestBlogIso) latestBlogIso = iso;
    }
  }
} catch { /* noop */ }

// Páginas .astro estáticas: lastmod = último commit del fichero de ruta.
function walkStaticPages(dir, urlBase = '/') {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkStaticPages(full, `${urlBase}${entry.name}/`);
      continue;
    }
    if (!entry.name.endsWith('.astro')) continue;
    if (entry.name.includes('[')) continue;
    if (entry.name === '404.astro') continue;
    const urlPath = entry.name === 'index.astro'
      ? urlBase
      : `${urlBase}${entry.name.replace(/\.astro$/, '')}/`;
    setLastmod(urlPath, full);
  }
}
walkStaticPages(pagesDir);

// Ficheros de datos que alimentan listados / hubs (se queda la fecha más reciente).
setLastmod('/', problemSectionsFile, herramientasFile);
bumpLastmod('/', latestProductIso);
bumpLastmod('/', latestBlogIso);
bumpLastmod('/productos/', latestProductIso);
bumpLastmod('/blog/', latestBlogIso);

setLastmod('/herramientas/', herramientasFile);
setLastmod(
  '/calculadora-dosis-condroprotector-perros/',
  path.join(ROOT, 'src/components/CondroprotectorCalculator.tsx'),
  herramientasFile,
);
setLastmod(
  '/calculadora-talla-bozal-perros/',
  path.join(ROOT, 'src/components/BozalCalculator.tsx'),
  herramientasFile,
);
setLastmod(
  '/calculadora-talla-cama-ortopedica-perros/',
  path.join(ROOT, 'src/components/CamaOrtopedicaCalculator.tsx'),
  herramientasFile,
);
setLastmod(
  '/calculadora-medida-rampa-perros/',
  path.join(ROOT, 'src/components/RampaCalculator.tsx'),
  herramientasFile,
);
setLastmod(
  '/calculadora-talla-arnes-collar-perros/',
  path.join(ROOT, 'src/components/ArnesCollarCalculator.tsx'),
  herramientasFile,
);
setLastmod(
  '/calculadora-racion-pienso-renal-perros/',
  path.join(ROOT, 'src/components/PiensoRenalCalculator.tsx'),
  herramientasFile,
);
setLastmod('/rss.xml', path.join(pagesDir, 'rss.xml.ts'));
bumpLastmod('/rss.xml', latestBlogIso);

// Secciones-problema: lastmod del fichero donde están definidas.
try {
  const src = fs.readFileSync(problemSectionsFile, 'utf8');
  const start = src.indexOf('export const problemSections');
  const block = start >= 0 ? src.slice(start) : src;
  const re = /\bsection\(\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(block))) {
    setLastmod(`/categoria/${slugifyLike(m[1])}/`, problemSectionsFile, categoriaTpl);
  }
} catch { /* noop */ }

// https://astro.build/config
export default defineConfig({
  site: 'https://www.solucioncanina.es',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    react(),

    mdx(),
    sitemap({
      filter: (page) =>
        !noindexProductPaths.has(new URL(page).pathname) &&
        !page.includes('/asistente') &&
        !page.includes('/politica-privacidad') &&
        !page.includes('/politica-cookies') &&
        !page.includes('/recomienda/') &&
        !page.includes('/404'),
      serialize(item) {
        if (item.url.endsWith('/') && item.url.split('/').length === 4) {
          // Home page (https://domain/)
          item.changefreq = 'daily';
          item.priority = 1.0;
        } else if (item.url.includes('/productos')) {
          item.changefreq = 'daily';
          item.priority = 0.9;
        } else if (item.url.includes('/producto/')) {
          item.changefreq = 'weekly';
          item.priority = 0.7;
        } else if (item.url.includes('/categoria/')) {
          item.changefreq = 'weekly';
          item.priority = 0.7;
        } else if (item.url.includes('/blog/')) {
          item.changefreq = 'weekly';
          item.priority = 0.8;
        } else if (item.url.endsWith('/blog/') || item.url.endsWith('/blog')) {
          item.changefreq = 'daily';
          item.priority = 0.9;
        }
        // lastmod real del filesystem: contenido, plantilla .astro o datos que alimentan la URL.
        try {
          const u = new URL(item.url);
          const withSlash = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
          const noSlash = withSlash.slice(0, -1);
          const lm = lastmodMap.get(withSlash) || lastmodMap.get(noSlash) || lastmodMap.get(u.pathname);
          if (lm) item.lastmod = lm;
        } catch { /* noop */ }
        return item;
      },
    }),
    // Falla el build si hi ha enllaços interns trencats (evita la regressió dels 404).
    internalLinkCheck(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Evita múltiples còpies de React (framer-motion / illes) → "Invalid hook call" / useState null a dev.
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'framer-motion'],
    },
    ssr: {
      noExternal: ['framer-motion'],
    },
  },
});
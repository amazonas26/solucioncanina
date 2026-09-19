import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import internalLinkCheck from './scripts/astro-internal-link-check.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Precompute lastmod map: URL path → ISO date. Robust: failures don't break the build.
const lastmodMap = new Map();
function safeStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}
function latestIso(files) {
  let max = 0;
  for (const p of files) {
    const st = safeStat(p);
    if (st && st.mtimeMs > max) max = st.mtimeMs;
  }
  return max ? new Date(max).toISOString() : null;
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

const ROOT = path.resolve('.');
const pagesDir = path.join(ROOT, 'src/pages');
const articulosDir = path.join(ROOT, 'src/content/articulos');
const blogDir = path.join(ROOT, 'src/content/blog');
const problemSectionsFile = path.join(ROOT, 'src/utils/problemSections.ts');
const herramientasFile = path.join(ROOT, 'src/utils/herramientas.ts');
const categoriaTpl = path.join(pagesDir, 'categoria', '[slug].astro');
const productoTpl = path.join(pagesDir, 'producto', '[slug].astro');
const blogTpl = path.join(pagesDir, 'blog', '[slug].astro');

const categoryMaxMtime = new Map(); // categorySlug → ISO date (max mtime)
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
      const iso = st.mtime.toISOString();
      setLastmod(`/producto/${slug}/`, jsonPath, productoTpl);
      if (!latestProductIso || iso > latestProductIso) latestProductIso = iso;
      if (data.categoria) {
        const catSlug = slugifyLike(data.categoria);
        const prev = categoryMaxMtime.get(catSlug);
        if (!prev || st.mtime > new Date(prev)) categoryMaxMtime.set(catSlug, iso);
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
      const iso = st.mtime.toISOString();
      setLastmod(`/blog/${entry.name}/`, contentFile, blogTpl);
      if (!latestBlogIso || iso > latestBlogIso) latestBlogIso = iso;
    }
  }
} catch { /* noop */ }

// Páginas .astro estáticas: lastmod = mtime del fichero de ruta.
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

// Ficheros de datos que alimentan listados / hubs (se queda el mtime más reciente).
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
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
function slugifyLike(text) {
  // Must match src/utils/slugify.ts
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}
const categoryMaxMtime = new Map(); // categorySlug → ISO date (max mtime)
try {
  const articulosDir = path.resolve('src/content/articulos');
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
      lastmodMap.set(`/producto/${slug}/`, iso);
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
}
try {
  const blogDir = path.resolve('src/content/blog');
  if (fs.existsSync(blogDir)) {
    for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const mdxPath = path.join(blogDir, entry.name, 'index.mdx');
      const mdPath = path.join(blogDir, entry.name, 'index.md');
      const st = safeStat(mdxPath) || safeStat(mdPath);
      if (st) lastmodMap.set(`/blog/${entry.name}/`, st.mtime.toISOString());
    }
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
        // lastmod real des del filesystem (mtime de index.json / index.mdx).
        // Si no en tenim per aquesta URL el deixem buit: una data falsa
        // perjudica el crawl budget.
        try {
          const u = new URL(item.url);
          const lm = lastmodMap.get(u.pathname);
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
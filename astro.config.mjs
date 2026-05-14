import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import keystatic from '@keystatic/astro';
import vercel from '@astrojs/vercel';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.solucioncanina.es',
  output: 'static',
  adapter: vercel(),
  integrations: [
    react(),
    keystatic(),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/keystatic') &&
        !page.includes('/asistente') &&
        !page.includes('/aviso-legal') &&
        !page.includes('/politica-privacidad') &&
        !page.includes('/politica-cookies') &&
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
          item.changefreq = 'monthly';
          item.priority = 0.6;
        } else if (item.url.endsWith('/blog/') || item.url.endsWith('/blog')) {
          item.changefreq = 'weekly';
          item.priority = 0.7;
        }
        // Intencionalment no establim lastmod global: una data falsa
        // perjudica el crawl budget. Es deixarà buit fins que tinguem
        // dates reals per URL.
        return item;
      },
    }),
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
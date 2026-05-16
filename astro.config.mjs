import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

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

    mdx(),
    sitemap({
      filter: (page) =>

        !page.includes('/asistente') &&
        !page.includes('/404'),
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
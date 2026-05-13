import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import keystatic from '@keystatic/astro';
import vercel from '@astrojs/vercel';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: vercel(),
  integrations: [react(), keystatic(), mdx()],
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
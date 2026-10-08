/**
 * Rasteriza las cabeceras compuestas a PNG 1200×630 para Open Graph.
 * En tipográficas (B) el texto va solo aquí (`og: true`); en tarjetas/UI
 * el SVG es solo el fondo para no duplicar categoría/título.
 * Requiere @resvg/resvg-js (no está en las dependencias de la web).
 *
 *   NODE_PATH=/tmp/resvgtool/node_modules pnpm dlx tsx scripts/render-blog-og.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { composedHeaderSlugs } from '../src/components/illustrations/registry';
import { renderBlogHeader } from '../src/components/illustrations/compose';

const outDir = resolve('public/images/blog');

for (const slug of composedHeaderSlugs()) {
  const svg = renderBlogHeader(slug, { title: slug, decorative: true, og: true });
  if (!svg) throw new Error(`Sin SVG para ${slug}`);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    background: '#ffffff',
  });
  const png = resvg.render();
  const file = resolve(outDir, `${slug}.png`);
  writeFileSync(file, png.asPng());
  console.log(`${slug} ${png.width}x${png.height}`);
}

#!/usr/bin/env node
/**
 * Descarrega la imatge principal de cada producte des de la pàgina d'Amazon.es
 * (URL del camp linkAmazon), la guarda a public/images/articulos/{slug}/imagen.*
 * i actualitza el camp imagen a cada index.json.
 *
 * Ús: node scripts/fetch-amazon-images.mjs [--dry-run] [--delay=1500]
 *
 * Nota: Amazon pot limitar peticions massives; hi ha una pausa entre productes.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseArgs(argv) {
  let dryRun = false;
  let delayMs = 1500;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    const m = /^--delay=(\d+)$/.exec(a);
    if (m) delayMs = Math.max(0, parseInt(m[1], 10));
  }
  return { dryRun, delayMs };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractMainImageUrl(html) {
  const candidates = [
    /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+_AC_SL1500_\.jpg/gi,
    /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+_AC_SL1200_\.jpg/gi,
    /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+_AC_SL1000_\.jpg/gi,
  ];

  for (const re of candidates) {
    const seen = new Set();
    for (const m of html.matchAll(re)) {
      let url = m[0];
      url = url.split('&quot;')[0].replace(/\\u0026/g, '&');
      if (url.includes('_AC_US') || url.includes('_SR38,')) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      return url;
    }
  }

  let bestUrl = null;
  let bestN = 0;
  const reAny =
    /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+_AC_SL(\d+)_\.jpg/gi;
  for (const m of html.matchAll(reAny)) {
    const n = parseInt(m[1], 10);
    const u = m[0].split('&quot;')[0];
    if (n < 400 || u.includes('_AC_US')) continue;
    if (n > bestN) {
      bestN = n;
      bestUrl = u;
    }
  }
  if (bestUrl) return bestUrl.split('&amp;')[0];

  // Format nou sense _SL (ex. _AC_SX2940_SY165_.jpg o _AC_QL95_SX1960_SY110_.jpg)
  let bestArea = 0;
  const reSxSy =
    /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+_AC_(?:QL\d+_)?SX(\d+)_SY(\d+)_\.jpg/gi;
  for (const m of html.matchAll(reSxSy)) {
    const sx = parseInt(m[1], 10);
    const sy = parseInt(m[2], 10);
    let u = m[0].split('&quot;')[0].split('&amp;')[0];
    if (u.includes('FMwebp') || u.includes('FMavif')) continue;
    if (sx < 200 || sy < 200) continue;
    const area = sx * sy;
    if (area > bestArea) {
      bestArea = area;
      bestUrl = u;
    }
  }
  return bestUrl || null;
}

function extFromBuffer(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'jpg';
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return 'webp';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'png';
  return 'jpg';
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-ES,es;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });
  if (!res.ok) throw new Error(`HTML HTTP ${res.status}`);
  return await res.text();
}

async function fetchImageBytes(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://www.amazon.es/',
    },
  });
  if (!res.ok) throw new Error(`Imatge HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error('Imatge massa petita (possible error)');
  return buf;
}

async function main() {
  const { dryRun, delayMs } = parseArgs(process.argv.slice(2));
  const articulosDir = path.join(ROOT, 'src/content/articulos');
  const entries = await fs.readdir(articulosDir, { withFileTypes: true });
  const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  let ok = 0;
  let fail = 0;

  for (const slug of slugs.sort()) {
    const jsonPath = path.join(articulosDir, slug, 'index.json');
    let raw;
    try {
      raw = await fs.readFile(jsonPath, 'utf8');
    } catch {
      console.warn(`[skip] Sense JSON: ${slug}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.warn(`[skip] JSON invàlid ${slug}:`, e.message);
      fail++;
      continue;
    }

    const link = data.linkAmazon;
    if (!link || typeof link !== 'string') {
      console.warn(`[skip] ${slug}: sense linkAmazon`);
      fail++;
      continue;
    }

    process.stdout.write(`→ ${slug} … `);

    try {
      const html = await fetchHtml(link);

      const imageUrl = extractMainImageUrl(html);
      if (!imageUrl) {
        throw new Error('No s’ha trobat cap URL d’imatge _AC_SL* al HTML');
      }

      if (dryRun) {
        console.log(`dry-run: ${imageUrl}`);
        ok++;
        await sleep(delayMs);
        continue;
      }

      const buf = await fetchImageBytes(imageUrl);
      const ext = extFromBuffer(buf);
      const outDir = path.join(ROOT, 'public/images/articulos', slug);
      await fs.mkdir(outDir, { recursive: true });

      const filename = `imagen.${ext}`;
      const publicPath = path.join(outDir, filename);
      await fs.writeFile(publicPath, buf);

      const webPath = `/images/articulos/${slug}/${filename}`;
      data.imagen = webPath;
      await fs.writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

      console.log(`OK (${buf.length} bytes → ${webPath})`);
      ok++;
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      fail++;
    }

    await sleep(delayMs);
  }

  console.log(`\nFet: ${ok} correctes, ${fail} errors${dryRun ? ' (dry-run)' : ''}.`);
  process.exit(0);
}

const isDirectRun =
  path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

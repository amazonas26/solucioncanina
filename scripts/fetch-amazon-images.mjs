#!/usr/bin/env node
/**
 * Descarrega la imatge principal de cada producte des de la pàgina d'Amazon.es
 * (URL del camp linkAmazon), la guarda a public/images/articulos/{slug}/imagen.*
 * i actualitza el camp imagen a cada index.json.
 *
 * Ús: node scripts/fetch-amazon-images.mjs [--dry-run] [--delay=1500]
 *     node scripts/fetch-amazon-images.mjs --only=slug1,slug2
 *     node scripts/fetch-amazon-images.mjs --skip-ok   # salta si imagen.jpg > 80 KB
 *
 * Nota: Amazon pot limitar peticions massives; hi ha una pausa entre productes.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Amazon devuelve CAPTCHA / HTML mínimo si pedimos br+gzip explícito en Node. */
const HTML_HEADERS = {
  'User-Agent': UA,
  'Accept-Language': 'es-ES,es;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.amazon.es/',
};

/**
 * URL NETA per scrapejar, SENSE el tag d'afiliat. Visitar Amazon amb `?tag=` des
 * d'un script compta com un clic d'afiliat fals (infla clics + risc de ban). Per
 * baixar la imatge només cal el PDP net: https://www.amazon.es/dp/{ASIN}/
 */
function scrapeUrl(linkAmazon) {
  const m = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i.exec(linkAmazon || '');
  return m ? `https://www.amazon.es/dp/${m[1].toUpperCase()}/` : linkAmazon;
}

function parseArgs(argv) {
  let dryRun = false;
  let delayMs = 1500;
  let only = null;
  let skipOk = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    if (a === '--skip-ok') skipOk = true;
    const m = /^--delay=(\d+)$/.exec(a);
    if (m) delayMs = Math.max(0, parseInt(m[1], 10));
    const o = /^--only=(.+)$/.exec(a);
    if (o) only = new Set(o[1].split(',').map((s) => s.trim()).filter(Boolean));
  }
  return { dryRun, delayMs, only, skipOk };
}

const MIN_OK_BYTES = 80_000;

async function hasGoodLocalImage(slug) {
  const dir = path.join(ROOT, 'public/images/articulos', slug);
  for (const ext of ['jpg', 'jpeg', 'webp', 'png']) {
    try {
      const st = await fs.stat(path.join(dir, `imagen.${ext}`));
      if (st.size >= MIN_OK_BYTES) return true;
    } catch {
      /* missing */
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanUrl(raw) {
  return raw
    .split('&quot;')[0]
    .split('"')[0]
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .trim();
}

function isProductImageUrl(url) {
  if (!url.includes('media-amazon.com/images/I/')) return false;
  if (url.includes('_AC_US') || url.includes('_SR38,')) return false;
  if (/\.(js|css)(\?|$)/i.test(url)) return false;
  return true;
}

function pickBestSlUrl(html) {
  let bestUrl = null;
  let bestN = 0;
  const reAny =
    /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+_AC_SL(\d+)_\.(?:jpg|jpeg|png|webp)/gi;
  for (const m of html.matchAll(reAny)) {
    const n = parseInt(m[1], 10);
    const u = cleanUrl(m[0]);
    if (!isProductImageUrl(u) || n < 400) continue;
    if (n > bestN) {
      bestN = n;
      bestUrl = u;
    }
  }
  return bestUrl;
}

function extractFromHiRes(html) {
  const urls = [];
  for (const m of html.matchAll(/"hiRes":"(https:\/\/[^"]+)"/g)) {
    const u = cleanUrl(m[1]);
    if (isProductImageUrl(u)) urls.push(u);
  }
  return urls[0] || null;
}

function extractFromDynamicImage(html) {
  const m = html.match(/data-a-dynamic-image="(\{[^"]+\})"/);
  if (!m) return null;
  const decoded = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  let bestUrl = null;
  let bestArea = 0;
  for (const um of decoded.matchAll(/"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)":\[(\d+),(\d+)\]/g)) {
    const u = cleanUrl(um[1]);
    const w = parseInt(um[2], 10);
    const h = parseInt(um[3], 10);
    if (!isProductImageUrl(u)) continue;
    const area = w * h;
    if (area > bestArea) {
      bestArea = area;
      bestUrl = u;
    }
  }
  return bestUrl;
}

function extractMainImageUrl(html) {
  if (html.length < 50_000) return null;

  const hiRes = extractFromHiRes(html);
  if (hiRes) return hiRes;

  const sl = pickBestSlUrl(html);
  if (sl) return sl;

  const dynamic = extractFromDynamicImage(html);
  if (dynamic) {
    // Preferir variante _AC_SL* si existe en el mismo HTML
    const idMatch = dynamic.match(/\/images\/I\/([A-Za-z0-9._%+-]+)/);
    if (idMatch) {
      const id = idMatch[1].replace(/[.+]/g, '\\$&');
      const hi = new RegExp(
        `https://m\\.media-amazon\\.com/images/I/${id}_AC_SL(\\d+)_\\.(?:jpg|jpeg|webp)`,
        'i',
      ).exec(html);
      if (hi) return cleanUrl(hi[0]);
    }
    return dynamic;
  }

  let bestUrl = null;
  let bestArea = 0;
  const reSxSy =
    /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+_AC_(?:QL\d+_)?SX(\d+)_SY(\d+)_\.(?:jpg|jpeg|webp)/gi;
  for (const m of html.matchAll(reSxSy)) {
    const sx = parseInt(m[1], 10);
    const sy = parseInt(m[2], 10);
    const u = cleanUrl(m[0]);
    if (u.includes('FMwebp') || u.includes('FMavif')) continue;
    if (sx < 200 || sy < 200) continue;
    const area = sx * sy;
    if (area > bestArea) {
      bestArea = area;
      bestUrl = u;
    }
  }
  return bestUrl;
}

function looksLikeBlockedPage(html) {
  return (
    html.length < 50_000 ||
    /api-services-support@amazon\.com|captcha|robot check/i.test(html)
  );
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
    headers: HTML_HEADERS,
  });
  if (!res.ok) throw new Error(`HTML HTTP ${res.status}`);
  const html = await res.text();
  if (looksLikeBlockedPage(html)) {
    throw new Error(
      'Resposta bloquejada o CAPTCHA d’Amazon (HTML massa curt). Espera i torna-ho a provar.',
    );
  }
  return html;
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
  const { dryRun, delayMs, only, skipOk } = parseArgs(process.argv.slice(2));
  const articulosDir = path.join(ROOT, 'src/content/articulos');
  const entries = await fs.readdir(articulosDir, { withFileTypes: true });
  let slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (only) slugs = slugs.filter((s) => only.has(s));

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

    if (skipOk && !dryRun && (await hasGoodLocalImage(slug))) {
      console.log(`skip (imatge OK)`);
      ok++;
      continue;
    }

    process.stdout.write(`→ ${slug} … `);

    try {
      const html = await fetchHtml(scrapeUrl(link));

      const imageUrl = extractMainImageUrl(html);
      if (!imageUrl) {
        throw new Error('No s’ha trobat cap URL d’imatge de producte al HTML');
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

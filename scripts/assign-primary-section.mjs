#!/usr/bin/env node
/**
 * Propone una `seccionPrimaria` para cada producto del catálogo (sin modificar archivos).
 *
 * Imprime un diff por stdout: una línea por producto con la sección primaria sugerida.
 * El usuario revisa manualmente y, si está conforme, aplica con `--write`.
 *
 * Política:
 *   1. Si el JSON ya define `seccionPrimaria`, se respeta y no se sugiere cambio.
 *   2. Si el JSON tiene `secciones` (array), se elige la primera entrada como primaria.
 *   3. Si no, se infiere a partir de `categoria` con un mapeo conservador.
 *   4. Si nada encaja, se reporta como `??` para revisión manual.
 *
 * Uso:
 *   node scripts/assign-primary-section.mjs           # dry-run (solo imprime)
 *   node scripts/assign-primary-section.mjs --write   # escribe seccionPrimaria a cada JSON
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const articulosDir = join(__dirname, "..", "src", "content", "articulos");
const WRITE = process.argv.includes("--write");

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Slugs reales de las problemSections (deben coincidir con problemSections.ts).
const SECTION_SLUGS = {
  movilidad: slugify("Movilidad y artrosis"),
  descanso: slugify("Descanso ortopédico"),
  renal: slugify("Problemas renales y urinarios"),
  digestion: slugify("Digestión sensible"),
  ansiedad: slugify("Ansiedad y estrés"),
  senior: slugify("Perros senior"),
  paseos: slugify("Paseos seguros y control"),
  rampa: slugify("Subir al coche o sofá"),
};

// Mapeo conservador: categoría → sección primaria sugerida.
const CATEGORY_TO_PRIMARY = {
  "Camas ortopédicas": SECTION_SLUGS.descanso,
  Condroprotectores: SECTION_SLUGS.movilidad,
  Rampas: SECTION_SLUGS.rampa,
  Correas: SECTION_SLUGS.paseos,
  Bozales: SECTION_SLUGS.paseos,
  Ansiedad: SECTION_SLUGS.ansiedad,
};

function inferRenalOrDigestive(json) {
  const text = `${json.nombre ?? ""} ${json.descripcion ?? ""}`.toLowerCase();
  if (/(renal|urinari|kidney|oxalate)/.test(text)) return SECTION_SLUGS.renal;
  if (/(gastro|digest|probiotic|probiot|intestinal)/.test(text)) return SECTION_SLUGS.digestion;
  return null;
}

function proposePrimary(json) {
  if (typeof json.seccionPrimaria === "string" && json.seccionPrimaria.length > 0) {
    return { value: json.seccionPrimaria, source: "preserved" };
  }
  if (Array.isArray(json.secciones) && json.secciones.length > 0) {
    return { value: slugify(json.secciones[0]), source: "first-secciones" };
  }
  if (json.categoria === "Alimentación específica") {
    const inferred = inferRenalOrDigestive(json);
    if (inferred) return { value: inferred, source: "alimentacion-inferred" };
  }
  const byCategory = CATEGORY_TO_PRIMARY[json.categoria];
  if (byCategory) return { value: byCategory, source: "category-map" };
  return { value: null, source: "??" };
}

const slugs = await readdir(articulosDir);
let written = 0;
let unresolved = 0;
const lines = [];

for (const slug of slugs) {
  const indexPath = join(articulosDir, slug, "index.json");
  let raw;
  try {
    raw = await readFile(indexPath, "utf8");
  } catch {
    continue;
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    lines.push(`SKIP   ${slug}  (JSON inválido: ${err.message})`);
    continue;
  }

  const proposal = proposePrimary(json);
  if (proposal.value === null) {
    unresolved += 1;
    lines.push(`MANUAL ${slug.padEnd(60)}  categoria=${json.categoria ?? "—"}`);
    continue;
  }
  if (proposal.source === "preserved") {
    lines.push(`KEEP   ${slug.padEnd(60)}  ${proposal.value}`);
    continue;
  }
  lines.push(`SET    ${slug.padEnd(60)}  ${proposal.value}   [${proposal.source}]`);

  if (WRITE && json.seccionPrimaria !== proposal.value) {
    json.seccionPrimaria = proposal.value;
    const next = JSON.stringify(json, null, 2) + "\n";
    await writeFile(indexPath, next, "utf8");
    written += 1;
  }
}

console.log(lines.join("\n"));
console.log("");
console.log(`Total productos: ${slugs.length}`);
console.log(`Manuales pendientes (sin propuesta): ${unresolved}`);
if (WRITE) console.log(`Escritos: ${written}`);
else console.log(`Modo dry-run. Ejecuta con --write para aplicar.`);

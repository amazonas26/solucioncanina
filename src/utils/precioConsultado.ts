// Data en què es va consultar a Amazon.es el preu (i la valoració) de cada producte.
// La manté `scripts/update_prices.py` a `src/data/precios-consultados.json`
// (slug → AAAA-MM-DD). Fitxer a part perquè la data de consulta canvia cada
// setmana i no ha de moure el `lastmod` del sitemap de les fitxes.
import fechas from '../data/precios-consultados.json';

const FECHAS = fechas as Record<string, string>;

/** AAAA-MM-DD de l'última consulta del preu d'aquest producte, o null. */
export function fechaPrecio(slug?: string | null): string | null {
  return (slug && FECHAS[slug]) || null;
}

/** AAAA-MM-DD de la consulta més recent de tot el catàleg, o null. */
export function ultimaConsultaPrecios(): string | null {
  const dates = Object.values(FECHAS).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** AAAA-MM-DD → DD/MM/AAAA (sense Intl: idèntic al servidor i al navegador). */
export function formatFechaPrecio(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Nota per a llistats: la data (o el rang de dates) dels preus que es mostren. */
export function notaPrecios(slugs: (string | null | undefined)[]): string | null {
  const dates = slugs.map(fechaPrecio).filter((d): d is string => !!d).sort();
  if (dates.length === 0) return null;
  const min = formatFechaPrecio(dates[0]);
  const max = formatFechaPrecio(dates[dates.length - 1]);
  const cuando = min === max ? `el ${min}` : `entre el ${min} y el ${max}`;
  return `Precios y valoraciones de Amazon.es consultados ${cuando}. Pueden haber cambiado.`;
}

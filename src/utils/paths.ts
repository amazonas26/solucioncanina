/**
 * Normaliza rutas internas al formato con barra final (`trailingSlash: 'always'`).
 * No modifica assets con extensión (png, xml, txt, …), URLs externas ni anclas.
 */

const ASSET_EXT =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|xml|txt|json|js|mjs|css|map|woff2?|ttf|eot|pdf|mp4|webm|mp3|wav)$/i;

/**
 * Asegura barra final en paths internos de página.
 * Conserva query (`?…`) y hash (`#…`).
 */
export function withTrailingSlash(path: string): string {
  if (!path) return '/';

  // Externos / protocolos / anclas puras
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    path.startsWith('//') ||
    path.startsWith('#')
  ) {
    return path;
  }

  const qIndex = path.indexOf('?');
  const hIndex = path.indexOf('#');
  let cut = path.length;
  if (qIndex >= 0) cut = Math.min(cut, qIndex);
  if (hIndex >= 0) cut = Math.min(cut, hIndex);

  let pathname = path.slice(0, cut) || '/';
  const suffix = path.slice(cut);

  if (!pathname.startsWith('/')) pathname = `/${pathname}`;

  // Assets: no añadir /
  if (ASSET_EXT.test(pathname)) return pathname + suffix;

  if (pathname !== '/' && !pathname.endsWith('/')) pathname += '/';
  return pathname + suffix;
}

export function productPath(slug: string): string {
  return withTrailingSlash(`/producto/${slug}`);
}

export function blogPath(slug: string): string {
  return withTrailingSlash(`/blog/${slug}`);
}

export function categoriaPath(slug: string): string {
  return withTrailingSlash(`/categoria/${slug}`);
}

export function recomiendaPath(slug: string): string {
  return withTrailingSlash(`/recomienda/${slug}`);
}

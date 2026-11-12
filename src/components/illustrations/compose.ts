import {
  BLOG_HEADERS,
  hasBlogHeader,
  type Campo,
  type HeaderSpec,
  type TypographicSpec,
} from './registry';

const DOG = '#2a6557';
const INK = '#1b1916';
const CLAY = '#9a4a28';

const r = (v: number) => Math.round(v * 10) / 10;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface RenderBlogHeaderOptions {
  title: string;
  decorative?: boolean;
  og?: boolean;
}

function svgShell(
  opts: RenderBlogHeaderOptions,
  labelled: string,
  text: string,
  body: string,
): string {
  const viewBox = opts.og ? '0 30 1600 840' : '0 0 1600 900';
  const size = opts.og ? 'width="1200" height="630"' : 'width="100%" height="100%"';
  const fit = opts.og ? 'xMidYMid meet' : 'xMidYMid slice';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${size} preserveAspectRatio="${fit}" fill="none" ${labelled} style="display:block">${text}
    ${body}
  </svg>`;
}

function typographicField(campo: Campo, id: string): string {
  const warm = campo.startsWith('warm') || campo.startsWith('cream');
  const blue = campo.startsWith('blue');
  const bg = warm ? '#efe3d3' : blue ? '#e4e0d7' : '#dfe9e3';
  const dot = `${id}-typ-dots`;
  const dotColor = warm ? CLAY : blue ? INK : DOG;
  return `<defs><pattern id="${dot}" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.5" fill="${dotColor}" fill-opacity="0.12"/></pattern></defs>
    <rect width="1600" height="900" fill="${bg}"/>
    <rect width="1600" height="900" fill="url(#${dot})"/>`;
}

function renderTypographic(slug: string, spec: TypographicSpec, opts: RenderBlogHeaderOptions): string {
  const id = `typ-${slug}`;
  // Portada tipogràfica: el tema de l'article en gran sobre un fons pla. A les
  // targetes (decorative) el títol complet ja va a l'HTML i l'SVG queda ocult
  // als lectors de pantalla.
  const labelled = opts.decorative ? 'aria-hidden="true"' : 'role="img"';
  const text = opts.decorative
    ? ''
    : `<title>${esc(opts.title)}</title><desc>${esc(spec.desc)}</desc>`;

  // A la UI la caixa és 16:9 o 16:10 i l'SVG fa «slice»: es retallen uns 90
  // punts per banda, d'aquí el marge esquerre més gran i la lletra més grossa.
  const lineCount = spec.lines.length;
  const fontSize = opts.og
    ? lineCount >= 3 ? 58 : lineCount === 1 ? 78 : 68
    : lineCount >= 3 ? 88 : 104;
  const x = opts.og ? 96 : 150;
  const lineHeight = fontSize * 1.18;
  const startY = (opts.og ? 340 : 500) - ((lineCount - 1) * lineHeight) / 2;
  const eyebrowY = startY - fontSize - (opts.og ? 30 : 60);
  const tspans = spec.lines
    .map((line, i) => `<tspan x="${x}" y="${r(startY + i * lineHeight)}">${esc(line)}</tspan>`)
    .join('');
  const copy = `<text x="${x}" y="${r(eyebrowY)}" fill="${CLAY}" font-family="'Libre Franklin', Arial, sans-serif" font-size="${opts.og ? 22 : 34}" font-weight="700" letter-spacing="0.12em">${esc(spec.eyebrow.toUpperCase())}</text>
    <text fill="${INK}" font-family="Newsreader, Georgia, serif" font-size="${fontSize * 1.08}" font-weight="600" letter-spacing="-0.025em">${tspans}</text>`;

  return svgShell(
    opts,
    labelled,
    text,
    `${typographicField(spec.campo, id)}
    ${copy}`,
  );
}

export function renderBlogHeader(slug: string, opts: RenderBlogHeaderOptions): string | null {
  if (!hasBlogHeader(slug)) return null;
  const spec: HeaderSpec = BLOG_HEADERS[slug];
  return renderTypographic(slug, spec, opts);
}

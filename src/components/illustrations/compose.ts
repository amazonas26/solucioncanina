import {
  BLOG_HEADERS,
  hasBlogHeader,
  type Campo,
  type HeaderSpec,
  type TypographicSpec,
} from './registry';

const DOG = '#3C9E91';
const INK = '#1B3A5C';
const MINT_LIGHT = '#ade1db';

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
  const bg = warm ? '#f6f1e4' : blue ? '#eef3f8' : '#eef9f7';
  const soft = warm ? '#eadfc8' : blue ? '#d4deeb' : '#d5f0ec';
  const mid = warm ? '#e4d3ae' : blue ? '#a9bdd7' : MINT_LIGHT;
  const dot = `${id}-typ-dots`;
  const dotColor = warm ? '#C4A46A' : blue ? INK : DOG;
  return `<defs><pattern id="${dot}" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.5" fill="${dotColor}" fill-opacity="0.12"/></pattern></defs>
    <rect width="1600" height="900" fill="${bg}"/>
    <rect width="1600" height="900" fill="url(#${dot})"/>
    <circle cx="1280" cy="200" r="340" fill="${INK}" fill-opacity="0.08"/>
    <circle cx="1280" cy="200" r="210" fill="${soft}" fill-opacity="0.85"/>
    <circle cx="1280" cy="200" r="120" fill="${mid}" fill-opacity="0.45"/>
    <path d="M640 840 Q1020 500 1520 660" stroke="${DOG}" stroke-width="14" fill="none" opacity="0.32" stroke-linecap="round"/>`;
}

function renderTypographic(slug: string, spec: TypographicSpec, opts: RenderBlogHeaderOptions): string {
  const id = `typ-${slug}`;
  // UI: geometric brand field only — never bake title/eyebrow (already in HTML).
  // Title copy only for og:image.
  const labelled = opts.decorative ? 'aria-hidden="true"' : 'role="img"';
  const text = opts.decorative
    ? ''
    : `<title>${esc(opts.title)}</title><desc>${esc(spec.desc)}</desc>`;

  let copy = '';
  if (opts.og) {
    const lineCount = spec.lines.length;
    const fontSize = lineCount >= 3 ? 58 : lineCount === 1 ? 78 : 68;
    const lineHeight = fontSize * 1.18;
    const startY = 340 - ((lineCount - 1) * lineHeight) / 2;
    const tspans = spec.lines
      .map((line, i) => {
        const y = startY + i * lineHeight;
        return `<tspan x="96" y="${r(y)}">${esc(line)}</tspan>`;
      })
      .join('');
    copy = `<text x="96" y="210" fill="${DOG}" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700" letter-spacing="0.14em">${esc(spec.eyebrow.toUpperCase())}</text>
    <rect x="96" y="228" width="72" height="4" rx="2" fill="${DOG}"/>
    <text fill="${INK}" font-family="Merriweather, Georgia, serif" font-size="${fontSize}" font-weight="900" letter-spacing="-0.02em">${tspans}</text>`;
  }

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

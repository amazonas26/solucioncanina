import {
  BLOG_HEADERS,
  hasBlogHeader,
  type Campo,
  type HeaderSpec,
  type IllustrationSpec,
  type Motivo,
  type Pose,
  type Silueta,
  type TypographicSpec,
} from './registry';

const DOG = '#3C9E91';
const DOG_DEEP = '#2f7f75';
const INK = '#1B3A5C';
const INK2 = '#244b7c';
const MINT = '#7bccc3';
const MINT_LIGHT = '#ade1db';

type Ear = 'floppy' | 'erect' | 'bat' | 'prick';
type Tail = 'curl' | 'feather' | 'bush' | 'short' | 'flag';

interface Preset {
  ear: Ear;
  tail: Tail;
  bodyRx: number;
  bodyRy: number;
  headR: number;
  muzzleRx: number;
  muzzleRy: number;
  legW: number;
  legH: number;
}

interface Pt {
  x: number;
  y: number;
}

interface DogLayout {
  svg: string;
  hip: Pt;
  neck: Pt;
  nose: Pt;
  footY: number;
  cx: number;
}

const PRESETS: Record<Silueta, Preset> = {
  labrador: { ear: 'floppy', tail: 'curl', bodyRx: 200, bodyRy: 162, headR: 136, muzzleRx: 112, muzzleRy: 64, legW: 72, legH: 146 },
  golden: { ear: 'floppy', tail: 'feather', bodyRx: 188, bodyRy: 148, headR: 122, muzzleRx: 124, muzzleRy: 52, legW: 52, legH: 164 },
  pastor: { ear: 'erect', tail: 'bush', bodyRx: 214, bodyRy: 118, headR: 108, muzzleRx: 112, muzzleRy: 44, legW: 46, legH: 172 },
  bulldog: { ear: 'bat', tail: 'short', bodyRx: 228, bodyRy: 164, headR: 164, muzzleRx: 60, muzzleRy: 36, legW: 78, legH: 108 },
  collie: { ear: 'prick', tail: 'flag', bodyRx: 206, bodyRy: 104, headR: 96, muzzleRx: 140, muzzleRy: 38, legW: 42, legH: 156 },
  medio: { ear: 'floppy', tail: 'flag', bodyRx: 186, bodyRy: 150, headR: 124, muzzleRx: 114, muzzleRy: 54, legW: 64, legH: 142 },
  senior: { ear: 'floppy', tail: 'curl', bodyRx: 210, bodyRy: 158, headR: 120, muzzleRx: 98, muzzleRy: 50, legW: 68, legH: 118 },
  pequeno: { ear: 'bat', tail: 'short', bodyRx: 188, bodyRy: 142, headR: 128, muzzleRx: 50, muzzleRy: 32, legW: 62, legH: 112 },
};

const GROUND = 778;

const r = (v: number) => Math.round(v * 10) / 10;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pill(x: number, y: number, w: number, h: number, rot = 0): string {
  const rx = Math.min(w, h) / 2;
  const transform =
    rot === 0 ? '' : ` transform="rotate(${r(rot)} ${r(x + w / 2)} ${r(y)})"`;
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(rx)}"${transform}/>`;
}

function ear(type: Ear, hx: number, hy: number, headR: number): string {
  const k = headR / 130;
  if (type === 'floppy') {
    const cx = hx - 88 * k;
    const cy = hy + 28 * k;
    return `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(54 * k)}" ry="${r(102 * k)}" transform="rotate(-22 ${r(cx)} ${r(cy)})"/>`;
  }
  if (type === 'erect') {
    const a = { x: hx - 18 * k, y: hy - headR * 0.92 };
    const b = { x: hx + 42 * k, y: hy - headR * 0.88 };
    return `<ellipse cx="${r(a.x)}" cy="${r(a.y)}" rx="${r(22 * k)}" ry="${r(68 * k)}" transform="rotate(-10 ${r(a.x)} ${r(a.y)})"/>
      <ellipse cx="${r(b.x)}" cy="${r(b.y)}" rx="${r(20 * k)}" ry="${r(62 * k)}" transform="rotate(14 ${r(b.x)} ${r(b.y)})"/>`;
  }
  if (type === 'bat') {
    const a = { x: hx - headR * 0.62, y: hy - headR * 0.78 };
    const b = { x: hx + headR * 0.48, y: hy - headR * 0.86 };
    return `<ellipse cx="${r(a.x)}" cy="${r(a.y)}" rx="${r(64 * k)}" ry="${r(42 * k)}" transform="rotate(-16 ${r(a.x)} ${r(a.y)})"/>
      <ellipse cx="${r(b.x)}" cy="${r(b.y)}" rx="${r(60 * k)}" ry="${r(40 * k)}" transform="rotate(20 ${r(b.x)} ${r(b.y)})"/>`;
  }
  const cx = hx - 8 * k;
  const cy = hy - headR * 0.95;
  return `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(18 * k)}" ry="${r(62 * k)}" transform="rotate(-6 ${r(cx)} ${r(cy)})"/>`;
}

function tail(type: Tail, bx: number, by: number, bodyRx: number, bodyRy: number): string {
  if (type === 'curl') {
    const x = bx - bodyRx + 10;
    const y = by - bodyRy * 0.15;
    return `<path d="M${r(x)} ${r(y)}
      C${r(x - 90)} ${r(y + 24)}, ${r(x - 120)} ${r(y - 70)}, ${r(x - 40)} ${r(y - 108)}
      C${r(x + 40)} ${r(y - 146)}, ${r(x + 108)} ${r(y - 70)}, ${r(x + 64)} ${r(y - 16)}
      C${r(x + 40)} ${r(y + 10)}, ${r(x + 16)} ${r(y + 16)}, ${r(x)} ${r(y)}Z"/>`;
  }
  if (type === 'feather') {
    const x = bx - bodyRx * 0.72;
    const y = by - bodyRy * 0.05;
    return `<ellipse cx="${r(x)}" cy="${r(y)}" rx="${r(bodyRx * 0.62)}" ry="34" transform="rotate(-18 ${r(x)} ${r(y)})"/>
      <ellipse cx="${r(x - bodyRx * 0.48)}" cy="${r(y - 16)}" rx="${r(bodyRx * 0.28)}" ry="16" transform="rotate(-8 ${r(x - bodyRx * 0.48)} ${r(y - 16)})"/>`;
  }
  if (type === 'bush') {
    const x = bx - bodyRx * 0.78;
    const y = by - bodyRy * 0.55;
    return `<ellipse cx="${r(x)}" cy="${r(y)}" rx="34" ry="${r(bodyRy * 0.85)}" transform="rotate(36 ${r(x)} ${r(y)})"/>`;
  }
  if (type === 'short') {
    return `<ellipse cx="${r(bx - bodyRx * 0.9)}" cy="${r(by + bodyRy * 0.1)}" rx="26" ry="20"/>`;
  }
  const x = bx - bodyRx * 0.95;
  const y = by - 8;
  return `<ellipse cx="${r(x)}" cy="${r(y)}" rx="${r(bodyRx * 0.58)}" ry="28" transform="rotate(-16 ${r(x)} ${r(y)})"/>`;
}

function bodyEllipse(cx: number, cy: number, rx: number, ry: number, transform = ''): string {
  const t = transform ? ` transform="${transform}"` : '';
  return `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="${DOG}"${t}/>
    <ellipse cx="${r(cx + rx * 0.08)}" cy="${r(cy - ry * 0.22)}" rx="${r(rx * 0.62)}" ry="${r(ry * 0.48)}" fill="${MINT}" fill-opacity="0.32"${t}/>
    <ellipse cx="${r(cx - rx * 0.06)}" cy="${r(cy + ry * 0.38)}" rx="${r(rx * 0.72)}" ry="${r(ry * 0.36)}" fill="${DOG_DEEP}" fill-opacity="0.28"${t}/>`;
}

function face(hx: number, hy: number, headR: number, mx: number, my: number, mrx: number, mry: number): string {
  const eyeX = hx - headR * 0.28;
  const eyeY = hy - headR * 0.12;
  const eyeEnd = hx + headR * 0.4;
  const eyeMid = (eyeX + eyeEnd) / 2;
  const stroke = Math.max(7, headR * 0.065);
  const short = mrx < 78;
  const smile = short
    ? `M${r(hx - headR * 0.02)} ${r(hy + headR * 0.22)} Q${r(hx + headR * 0.28)} ${r(hy + headR * 0.48)} ${r(hx + headR * 0.55)} ${r(hy + headR * 0.18)}`
    : `M${r(mx - mrx * 0.38)} ${r(my + mry * 0.12)} Q${r(mx + mrx * 0.15)} ${r(my + mry * 0.7)} ${r(mx + mrx * 0.62)} ${r(my + mry * 0.16)}`;
  const nx = mx + mrx * (short ? 0.28 : 0.72);
  const ny = my - mry * 0.02;
  const nrx = Math.max(11, mrx * 0.16);
  const cheekX = hx + headR * 0.12;
  const cheekY = hy + headR * 0.18;
  return `<ellipse cx="${r(cheekX)}" cy="${r(cheekY)}" rx="${r(headR * 0.42)}" ry="${r(headR * 0.32)}" fill="${MINT}" fill-opacity="0.22"/>
    <ellipse cx="${r(nx)}" cy="${r(ny)}" rx="${r(nrx)}" ry="${r(nrx * 0.78)}" fill="${INK}"/>
    <circle cx="${r(eyeMid - headR * 0.02)}" cy="${r(eyeY + headR * 0.06)}" r="${r(Math.max(5, headR * 0.055))}" fill="${INK}" fill-opacity="0.35"/>
    <path d="M${r(eyeX)} ${r(eyeY)} Q${r(eyeMid)} ${r(eyeY + headR * 0.2)} ${r(eyeEnd)} ${r(eyeY)}" fill="none" stroke="${INK}" stroke-width="${r(stroke)}" stroke-linecap="round"/>
    <path d="${smile}" fill="none" stroke="${INK}" stroke-width="${r(stroke * 0.9)}" stroke-linecap="round"/>`;
}

function headParts(p: Preset, hx: number, hy: number, shift: Pt = { x: 0, y: 0 }) {
  const mx = hx + shift.x + p.headR * 0.42 + p.muzzleRx * 0.35;
  const my = hy + shift.y + p.headR * 0.22;
  const group = shift.x || shift.y ? ` transform="translate(${r(shift.x)} ${r(shift.y)})"` : '';
  const shapes = `<g${group}>
      <circle cx="${r(hx)}" cy="${r(hy)}" r="${r(p.headR)}"/>
      ${ear(p.ear, hx, hy, p.headR)}
      <ellipse cx="${r(mx - shift.x)}" cy="${r(my - shift.y)}" rx="${r(p.muzzleRx)}" ry="${r(p.muzzleRy)}"/>
    </g>`;
  // Muzzle ellipse above is in unshifted local coords inside the translated group.
  // Recompute world muzzle for the face, which is NOT inside the group if I separate face.
  const worldHx = hx + shift.x;
  const worldHy = hy + shift.y;
  const worldMx = worldHx + p.headR * 0.42 + p.muzzleRx * 0.35;
  const worldMy = worldHy + p.headR * 0.22;
  return {
    shapes,
    face: face(worldHx, worldHy, p.headR, worldMx, worldMy, p.muzzleRx, p.muzzleRy),
    nose: {
      x: worldMx + p.muzzleRx * (p.muzzleRx < 78 ? 0.28 : 0.72),
      y: worldMy,
    },
    neck: { x: worldHx - p.headR * 0.05, y: worldHy + p.headR * 0.72 },
  };
}

function settle(dog: DogLayout): DogLayout {
  const shift = GROUND - dog.footY;
  if (Math.abs(shift) < 0.5) return dog;
  const move = (pt: Pt): Pt => ({ x: pt.x, y: pt.y + shift });
  return {
    svg: `<g transform="translate(0 ${r(shift)})">${dog.svg}</g>`,
    hip: move(dog.hip),
    neck: move(dog.neck),
    nose: move(dog.nose),
    footY: GROUND,
    cx: dog.cx,
  };
}

function rotateLayout(dog: DogLayout, deg: number, pivot: Pt): DogLayout {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const spin = (pt: Pt): Pt => {
    const dx = pt.x - pivot.x;
    const dy = pt.y - pivot.y;
    return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
  };
  return {
    svg: `<g transform="rotate(${r(deg)} ${r(pivot.x)} ${r(pivot.y)})">${dog.svg}</g>`,
    hip: spin(dog.hip),
    neck: spin(dog.neck),
    nose: spin(dog.nose),
    footY: spin({ x: dog.cx, y: dog.footY }).y,
    cx: dog.cx,
  };
}

function sitting(p: Preset, scratch: boolean): DogLayout {
  const bx = 620;
  const by = 575;
  const hx = bx + p.bodyRx * 0.95;
  const hy = by - p.bodyRy - p.headR * 0.22;
  const legY = by + p.bodyRy * 0.62;
  const legH = Math.max(p.legH, 128);
  const head = headParts(p, hx, hy);
  const scratchLeg = scratch
    ? pill(
        bx - p.bodyRx * 0.05,
        by - p.bodyRy * 0.35,
        Math.max(34, p.legW * 0.72),
        p.legH * 1.15,
        -78,
      )
    : '';
  const svg = `<g fill="${DOG}">
      ${tail(p.tail, bx, by, p.bodyRx, p.bodyRy)}
      ${bodyEllipse(bx, by, p.bodyRx, p.bodyRy)}
      ${scratchLeg}
      ${pill(bx + p.bodyRx * 0.08, legY, p.legW, legH)}
      ${pill(bx + p.bodyRx * 0.55, legY + 6, p.legW * 0.92, legH * 0.92)}
      ${head.shapes}
      <ellipse cx="${r(hx - p.headR * 0.15)}" cy="${r(hy - p.headR * 0.2)}" rx="${r(p.headR * 0.55)}" ry="${r(p.headR * 0.4)}" fill="${MINT}" fill-opacity="0.25"/>
    </g>
    ${head.face}`;
  return settle({
    svg,
    hip: { x: bx - p.bodyRx * 0.25, y: by },
    neck: head.neck,
    nose: head.nose,
    footY: legY + legH,
    cx: bx,
  });
}

function standing(
  p: Preset,
  opts: { headDx?: number; headDy?: number; lean?: boolean } = {},
): DogLayout {
  const bx = 700;
  const by = 530;
  const hx = bx + p.bodyRx * 0.48 + p.headR * 0.85;
  const hy = by - p.bodyRy * 0.72 - p.headR * 0.28;
  const shift = { x: opts.headDx ?? 0, y: opts.headDy ?? 0 };
  const head = headParts(p, hx, hy, shift);
  const legY = by + p.bodyRy * 0.58;
  const slots = [
    { t: -0.7, h: 1, rot: opts.lean ? 8 : 0 },
    { t: -0.28, h: 0.9, rot: 0 },
    { t: 0.16, h: 0.96, rot: opts.lean ? -8 : 0 },
    { t: 0.52, h: 0.84, rot: 0 },
  ];
  const legs = slots
    .map((slot) =>
      pill(bx + p.bodyRx * slot.t - p.legW / 2, legY + (1 - slot.h) * 10, p.legW, p.legH * slot.h, slot.rot),
    )
    .join('');
  const bridge =
    shift.y > 40
      ? `<ellipse cx="${r((bx + hx + shift.x) / 2)}" cy="${r((by + hy + shift.y) / 2)}" rx="${r(p.headR * 0.42)}" ry="${r(p.headR * 0.34)}"/>`
      : '';
  const body = opts.lean
    ? bodyEllipse(bx, by, p.bodyRx, p.bodyRy, `rotate(-14 ${r(bx)} ${r(by)})`)
    : bodyEllipse(bx, by, p.bodyRx, p.bodyRy);
  const svg = `<g fill="${DOG}">
      ${tail(p.tail, bx, by - (opts.lean ? 10 : 0), p.bodyRx, p.bodyRy)}
      ${body}
      ${bridge}
      ${legs}
      ${head.shapes}
      <ellipse cx="${r(hx - p.headR * 0.12)}" cy="${r(hy - p.headR * 0.18)}" rx="${r(p.headR * 0.5)}" ry="${r(p.headR * 0.36)}" fill="${MINT}" fill-opacity="0.25"/>
    </g>
    ${head.face}`;
  const laid = settle({
    svg,
    hip: { x: bx - p.bodyRx * 0.32, y: by },
    neck: head.neck,
    nose: head.nose,
    footY: legY + p.legH,
    cx: bx,
  });
  if (!opts.lean) return laid;
  return rotateLayout(laid, -8, { x: laid.cx + 30, y: GROUND });
}

function walking(p: Preset): DogLayout {
  const bx = 730;
  const by = 545;
  const hx = bx + p.bodyRx * 0.72 + p.headR * 0.55;
  const hy = by - p.bodyRy * 0.9 - p.headR * 0.2;
  const head = headParts(p, hx, hy);
  const slots = [
    { t: -0.78, dy: 0.2, h: 1, rot: 10 },
    { t: -0.32, dy: 0.48, h: 0.84, rot: -2 },
    { t: 0.18, dy: 0.28, h: 0.94, rot: -14 },
    { t: 0.62, dy: 0.55, h: 0.78, rot: 4 },
  ];
  const legs = slots
    .map((slot) =>
      pill(
        bx + p.bodyRx * slot.t - p.legW / 2,
        by + p.bodyRy * slot.dy,
        p.legW,
        p.legH * slot.h,
        slot.rot,
      ),
    )
    .join('');
  const footY = Math.max(...slots.map((slot) => by + p.bodyRy * slot.dy + p.legH * slot.h));
  const svg = `<g fill="${DOG}">
      ${tail(p.tail, bx - 10, by - 20, p.bodyRx, p.bodyRy)}
      ${bodyEllipse(bx, by, p.bodyRx, p.bodyRy * 0.82, `rotate(-12 ${r(bx)} ${r(by)})`)}
      ${legs}
      ${head.shapes}
      <ellipse cx="${r(hx - p.headR * 0.1)}" cy="${r(hy - p.headR * 0.16)}" rx="${r(p.headR * 0.48)}" ry="${r(p.headR * 0.34)}" fill="${MINT}" fill-opacity="0.25"/>
    </g>
    ${head.face}`;
  return settle({
    svg,
    hip: { x: bx - p.bodyRx * 0.35, y: by + 10 },
    neck: head.neck,
    nose: head.nose,
    footY,
    cx: bx,
  });
}

function lying(p: Preset): DogLayout {
  const bx = 760;
  const by = 640;
  const bodyRx = Math.max(220, p.bodyRx * 1.15);
  const bodyRy = Math.max(96, p.bodyRy * 0.58);
  const hx = bx + bodyRx * 0.78;
  const hy = by - bodyRy - p.headR * 0.35;
  const head = headParts(p, hx, hy);
  const legY = by + bodyRy * 0.55;
  const legH = Math.max(52, p.legH * 0.42);
  const svg = `<g fill="${DOG}">
      ${tail(p.tail, bx - bodyRx * 0.15, by, bodyRx * 0.8, bodyRy)}
      ${bodyEllipse(bx, by, bodyRx, bodyRy)}
      ${pill(bx - bodyRx * 0.42, legY, p.legW * 1.15, legH)}
      ${pill(bx + bodyRx * 0.08, legY + 6, p.legW, legH * 0.9)}
      ${head.shapes}
      <ellipse cx="${r(hx - p.headR * 0.1)}" cy="${r(hy - p.headR * 0.14)}" rx="${r(p.headR * 0.48)}" ry="${r(p.headR * 0.34)}" fill="${MINT}" fill-opacity="0.25"/>
    </g>
    ${head.face}`;
  return settle({
    svg,
    hip: { x: bx - bodyRx * 0.28, y: by },
    neck: head.neck,
    nose: head.nose,
    footY: legY + legH,
    cx: bx,
  });
}

function crouching(p: Preset): DogLayout {
  const bx = 740;
  const by = 610;
  const bodyRx = Math.max(210, p.bodyRx * 1.08);
  const bodyRy = Math.max(88, p.bodyRy * 0.55);
  const hx = bx + bodyRx * 0.72;
  const hy = by - bodyRy - p.headR * 0.2;
  const head = headParts(p, hx, hy);
  const legY = by + bodyRy * 0.72;
  const slots = [
    { t: -0.62, h: 0.72, rot: 8 },
    { t: -0.28, h: 0.62, rot: 0 },
    { t: 0.18, h: 0.7, rot: -6 },
    { t: 0.5, h: 0.58, rot: 0 },
  ];
  const legs = slots
    .map((slot) =>
      pill(bx + bodyRx * slot.t - p.legW / 2, legY, p.legW, p.legH * slot.h, slot.rot),
    )
    .join('');
  const svg = `<g fill="${DOG}">
      ${tail(p.tail, bx - 20, by, bodyRx, bodyRy)}
      ${bodyEllipse(bx, by, bodyRx, bodyRy, `rotate(-8 ${r(bx)} ${r(by)})`)}
      ${legs}
      ${head.shapes}
      <ellipse cx="${r(hx - p.headR * 0.1)}" cy="${r(hy - p.headR * 0.14)}" rx="${r(p.headR * 0.48)}" ry="${r(p.headR * 0.34)}" fill="${MINT}" fill-opacity="0.25"/>
    </g>
    ${head.face}`;
  const footY = Math.max(...slots.map((slot) => legY + p.legH * slot.h));
  return settle({
    svg,
    hip: { x: bx - bodyRx * 0.3, y: by },
    neck: head.neck,
    nose: head.nose,
    footY,
    cx: bx,
  });
}

function drawDog(silueta: Silueta, pose: Pose, dx = 0): DogLayout {
  const p = PRESETS[silueta];
  const dog =
    pose === 'sentado' || pose === 'rascandose'
      ? sitting(p, pose === 'rascandose')
      : pose === 'de-pie'
        ? standing(p)
        : pose === 'tirando'
          ? standing(p, { lean: true })
          : pose === 'hocico-bajo'
            ? standing(p, { headDx: 70, headDy: 250 })
            : pose === 'andando'
              ? walking(p)
              : pose === 'echado'
                ? lying(p)
                : crouching(p);
  if (!dx) return dog;
  const move = (pt: Pt): Pt => ({ x: pt.x + dx, y: pt.y });
  return {
    svg: `<g transform="translate(${r(dx)} 0)">${dog.svg}</g>`,
    hip: move(dog.hip),
    neck: move(dog.neck),
    nose: move(dog.nose),
    footY: dog.footY,
    cx: dog.cx + dx,
  };
}

function brandMark(opacity = 0.1): string {
  return `<path d="M120 180 L260 350 L500 110" stroke="${INK}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

function field(campo: Campo, id: string): string {
  const dot = `${id}-dots`;
  switch (campo) {
    case 'mint-dots':
      return `<defs><pattern id="${dot}" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.7" fill="#3C9E91" fill-opacity="0.16"/></pattern></defs>
        <rect width="1600" height="900" fill="#eef9f7"/>
        <rect width="1600" height="900" fill="url(#${dot})"/>
        <circle cx="1280" cy="220" r="280" fill="#d5f0ec"/>
        <circle cx="1280" cy="220" r="160" fill="${MINT_LIGHT}" fill-opacity="0.45"/>
        ${brandMark(0.1)}`;
    case 'blue-dots':
      return `<defs><pattern id="${dot}" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.5" fill="${INK}" fill-opacity="0.11"/></pattern></defs>
        <rect width="1600" height="900" fill="#eef3f8"/>
        <rect width="1600" height="900" fill="url(#${dot})"/>
        <circle cx="250" cy="200" r="260" fill="#d4deeb" fill-opacity="0.75"/>
        <circle cx="250" cy="200" r="140" fill="#a9bdd7" fill-opacity="0.35"/>
        ${brandMark(0.08)}`;
    case 'warm-hill':
      return `<defs><pattern id="${dot}" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.4" fill="${INK}" fill-opacity="0.08"/></pattern></defs>
        <rect width="1600" height="900" fill="#f6f1e4"/>
        <rect width="1600" height="900" fill="url(#${dot})"/>
        <path d="M-40 760 Q480 540 920 730 T1680 600 V900 H-40Z" fill="#eadfc8"/>
        <ellipse cx="250" cy="210" rx="300" ry="170" fill="#efe6d2"/>
        ${brandMark(0.08)}`;
    case 'mint-bands':
      return `<rect width="1600" height="900" fill="#eef9f7"/>
        <rect y="140" width="1600" height="64" fill="#d5f0ec" fill-opacity="0.75"/>
        <rect y="300" width="1600" height="48" fill="${MINT_LIGHT}" fill-opacity="0.35"/>
        <rect y="560" width="1600" height="70" fill="#d5f0ec" fill-opacity="0.5"/>
        ${brandMark(0.09)}`;
    case 'mint-bigdots':
      return `<defs><pattern id="${dot}" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3.2" fill="#3C9E91" fill-opacity="0.14"/></pattern></defs>
        <rect width="1600" height="900" fill="#e8f6f3"/>
        <rect width="1600" height="900" fill="url(#${dot})"/>
        <circle cx="1320" cy="180" r="220" fill="#d5f0ec"/>
        <circle cx="1320" cy="180" r="120" fill="${MINT_LIGHT}" fill-opacity="0.4"/>
        ${brandMark(0.1)}`;
    case 'blue-arc':
      return `<rect width="1600" height="900" fill="#eef3f8"/>
        <path d="M-80 820 Q280 260 800 540 T1720 300" stroke="${INK}" stroke-width="90" fill="none" opacity="0.08" stroke-linecap="round"/>
        <circle cx="240" cy="180" r="180" fill="#d4deeb" fill-opacity="0.7"/>
        ${brandMark(0.08)}`;
    case 'warm-dots':
      return `<defs><pattern id="${dot}" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.8" fill="#C4A46A" fill-opacity="0.28"/></pattern></defs>
        <rect width="1600" height="900" fill="#f8f3e8"/>
        <rect width="1600" height="900" fill="url(#${dot})"/>
        <circle cx="1320" cy="240" r="240" fill="#efe4cc"/>
        <circle cx="1320" cy="240" r="130" fill="#e4d3ae" fill-opacity="0.45"/>
        ${brandMark(0.08)}`;
    case 'mint-circles':
      return `<rect width="1600" height="900" fill="#eef9f7"/>
        <circle cx="180" cy="720" r="340" fill="#d5f0ec"/>
        <circle cx="180" cy="720" r="190" fill="${MINT_LIGHT}" fill-opacity="0.4"/>
        <circle cx="1380" cy="160" r="160" fill="#d5f0ec" fill-opacity="0.8"/>
        ${brandMark(0.09)}`;
    case 'blue-bands':
      return `<rect width="1600" height="900" fill="#eef3f8"/>
        <rect y="120" width="1600" height="56" fill="#d4deeb" fill-opacity="0.85"/>
        <rect y="280" width="1600" height="40" fill="#a9bdd7" fill-opacity="0.28"/>
        <rect y="620" width="1600" height="64" fill="#d4deeb" fill-opacity="0.55"/>
        ${brandMark(0.08)}`;
    case 'cream-dots':
      return `<defs><pattern id="${dot}" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="${INK}" fill-opacity="0.09"/></pattern></defs>
        <rect width="1600" height="900" fill="#f4f0e6"/>
        <rect width="1600" height="900" fill="url(#${dot})"/>
        <circle cx="220" cy="200" r="200" fill="#efe6d0"/>
        <circle cx="220" cy="200" r="110" fill="#e6d7b4" fill-opacity="0.4"/>
        ${brandMark(0.08)}`;
    case 'warm-arc':
      return `<rect width="1600" height="900" fill="#f7f1e6"/>
        <path d="M-60 180 Q480 620 1100 260 T1700 520" stroke="#C4A46A" stroke-width="100" fill="none" opacity="0.22" stroke-linecap="round"/>
        <circle cx="1360" cy="180" r="170" fill="#efe4cc"/>
        ${brandMark(0.08)}`;
    case 'blue-circles':
      return `<rect width="1600" height="900" fill="#e8eef5"/>
        <circle cx="1360" cy="260" r="300" fill="#d4deeb"/>
        <circle cx="1360" cy="260" r="170" fill="#c1d0e4" fill-opacity="0.45"/>
        <circle cx="180" cy="640" r="180" fill="#d4deeb" fill-opacity="0.55"/>
        ${brandMark(0.08)}`;
    default:
      return assertNever(campo);
  }
}

function star(cx: number, cy: number, radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? radius : radius * 0.38;
    pts.push(`${r(cx + Math.cos(ang) * rad)} ${r(cy + Math.sin(ang) * rad)}`);
  }
  return `<path d="M${pts.join(' L')}Z" fill="${INK}"/>`;
}

function bag(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <path d="M16 -250 h150 l-18 230 H34 Z" fill="${INK}"/>
      <rect x="36" y="-272" width="112" height="36" rx="10" fill="${INK2}"/>
      <circle cx="78" cy="-120" r="10" fill="${DOG}"/>
      <circle cx="108" cy="-98" r="7" fill="${MINT}"/>
      <circle cx="58" cy="-96" r="6" fill="${DOG}"/>
    </g>`;
}

function bottle(x: number, y: number, scale = 1): string {
  return `<g transform="translate(${r(x)} ${r(y)}) scale(${scale})">
      <rect x="0" y="-210" width="78" height="190" rx="18" fill="${INK}"/>
      <rect x="16" y="-248" width="46" height="46" rx="10" fill="${INK2}"/>
      <rect x="16" y="-150" width="46" height="34" rx="6" fill="${DOG}"/>
    </g>`;
}

function dropper(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <rect x="10" y="-176" width="44" height="176" rx="14" fill="${INK}"/>
      <rect x="4" y="-214" width="56" height="48" rx="16" fill="${INK2}"/>
      <rect x="20" y="-120" width="24" height="28" rx="4" fill="${DOG}"/>
      <circle cx="78" cy="-40" r="14" fill="${DOG}"/>
    </g>`;
}

function bowl(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <path d="M0 -118 L196 -118 L166 -18 Q98 0 30 -18 Z" fill="${INK}"/>
      <ellipse cx="98" cy="-118" rx="104" ry="22" fill="${INK}"/>
      <ellipse cx="98" cy="-118" rx="90" ry="13" fill="${INK2}"/>
      <circle cx="70" cy="-120" r="7" fill="${DOG}"/>
      <circle cx="104" cy="-124" r="6" fill="${MINT}"/>
      <circle cx="132" cy="-118" r="5.5" fill="${DOG}"/>
    </g>`;
}

function bed(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <rect x="0" y="-160" width="320" height="140" rx="40" fill="${INK}"/>
      <rect x="0" y="-230" width="320" height="86" rx="34" fill="${INK2}"/>
      <ellipse cx="160" cy="-100" rx="90" ry="22" fill="${DOG}" fill-opacity="0.85"/>
    </g>`;
}

function brush(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <rect x="0" y="-250" width="28" height="160" rx="10" fill="${INK}"/>
      <rect x="-24" y="-108" width="76" height="18" rx="6" fill="${INK2}"/>
      <rect x="-18" y="-90" width="12" height="52" rx="4" fill="${DOG}"/>
      <rect x="-2" y="-90" width="12" height="58" rx="4" fill="${DOG}"/>
      <rect x="14" y="-90" width="12" height="54" rx="4" fill="${DOG}"/>
      <rect x="30" y="-90" width="12" height="58" rx="4" fill="${DOG}"/>
      <rect x="46" y="-90" width="12" height="48" rx="4" fill="${DOG}"/>
    </g>`;
}

function toothbrush(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <rect x="0" y="-18" width="210" height="28" rx="12" fill="${INK}"/>
      <rect x="168" y="-32" width="78" height="56" rx="12" fill="${INK2}"/>
      <rect x="180" y="-48" width="10" height="22" rx="3" fill="${DOG}"/>
      <rect x="196" y="-52" width="10" height="26" rx="3" fill="${DOG}"/>
      <rect x="212" y="-48" width="10" height="22" rx="3" fill="${DOG}"/>
      <rect x="228" y="-50" width="10" height="24" rx="3" fill="${DOG}"/>
    </g>`;
}

function tablet(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <ellipse cx="0" cy="0" rx="62" ry="32" fill="${INK}"/>
      <path d="M0 -32 v64" stroke="${MINT}" stroke-width="7" stroke-linecap="round"/>
    </g>`;
}

function bone(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})" fill="${INK}">
      <rect x="0" y="-16" width="78" height="32" rx="12"/>
      <circle cx="6" cy="-12" r="18"/>
      <circle cx="6" cy="12" r="18"/>
      <circle cx="72" cy="-12" r="18"/>
      <circle cx="72" cy="12" r="18"/>
    </g>`;
}

function droplet(x: number, y: number): string {
  return `<path d="M${r(x)} ${r(y - 150)} C${r(x)} ${r(y - 150)} ${r(x + 58)} ${r(y - 70)} ${r(x + 58)} ${r(y - 28)} a46 46 0 1 1 -92 0 C${r(x - 34)} ${r(y - 70)} ${r(x)} ${r(y - 150)} ${r(x)} ${r(y - 150)}Z" fill="${DOG}"/>`;
}

function vest(x: number, y: number): string {
  return `<g transform="translate(${r(x)} ${r(y)})">
      <path fill="${INK}" fill-rule="evenodd" d="M28 -210 h104 l28 46 v164 H0 v-164 l28 -46z M36 -120 a22 36 0 1 0 44 0 a22 36 0 1 0 -44 0z M96 -120 a22 36 0 1 0 44 0 a22 36 0 1 0 -44 0z"/>
      <path d="M64 -210 v-28 a22 22 0 0 1 44 0 v28" fill="${INK2}"/>
      <rect x="34" y="-132" width="96" height="18" rx="7" fill="${DOG}"/>
    </g>`;
}

function ramp(): string {
  return `<path d="M70 790 L70 470 L470 790 Z" fill="${INK}" fill-opacity="0.92"/>
    <path d="M70 470 L470 790" stroke="${INK2}" stroke-width="16" stroke-linecap="round" fill="none"/>
    <rect x="54" y="452" width="32" height="338" rx="8" fill="${INK}" fill-opacity="0.35"/>`;
}

function house(): string {
  return `<g fill="${INK}">
      <rect x="150" y="500" width="230" height="270" rx="8"/>
      <path d="M118 512 L265 330 L412 512 Z"/>
      <rect x="230" y="610" width="74" height="160" fill="${INK2}"/>
      <rect x="176" y="548" width="48" height="48" rx="4" fill="#f6f1e4" fill-opacity="0.45"/>
      <rect x="308" y="548" width="48" height="48" rx="4" fill="#f6f1e4" fill-opacity="0.45"/>
    </g>`;
}

function waves(): string {
  return `<g fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round">
      <path d="M150 250 q40 -52 0 -104"/>
      <path d="M196 274 q64 -84 0 -168"/>
      <path d="M246 300 q88 -112 0 -224"/>
    </g>`;
}

function stars(): string {
  return `<g>${star(1280, 150, 36)}${star(1380, 230, 22)}${star(1460, 120, 28)}</g>`;
}

function hipMark(pt: Pt): string {
  return `<circle cx="${r(pt.x)}" cy="${r(pt.y)}" r="42" fill="${INK}" fill-opacity="0.16"/>
    <circle cx="${r(pt.x)}" cy="${r(pt.y)}" r="22" fill="none" stroke="${INK}" stroke-width="7"/>
    <circle cx="${r(pt.x)}" cy="${r(pt.y)}" r="7" fill="${INK}"/>`;
}

function scratchMarks(pt: Pt): string {
  const x = pt.x - 36;
  const y = pt.y - 150;
  return `<g fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round">
      <path d="M${r(x)} ${r(y)} l36 -16"/>
      <path d="M${r(x + 8)} ${r(y + 22)} l40 -12"/>
      <path d="M${r(x + 18)} ${r(y + 44)} l34 -8"/>
    </g>`;
}

function harness(): string {
  return `<g transform="translate(1180 760)">
      <path fill="${INK}" fill-rule="evenodd" d="M70 -70 m -62 0 a 62 62 0 1 0 124 0 a 62 62 0 1 0 -124 0 M70 -70 m -34 0 a 34 34 0 1 1 68 0 a 34 34 0 1 1 -68 0"/>
      <rect x="180" y="-210" width="22" height="150" rx="10" fill="${INK}"/>
      <rect x="250" y="-210" width="22" height="150" rx="10" fill="${INK}"/>
      <rect x="168" y="-150" width="116" height="22" rx="10" fill="${INK}"/>
      <rect x="168" y="-78" width="116" height="22" rx="10" fill="${DOG}"/>
    </g>`;
}

function leash(from: Pt, coiled: boolean): string {
  const x = from.x - 8;
  const y = from.y + 78;
  if (coiled) {
    return `<path d="M${r(x)} ${r(y)} C${r(x + 160)} ${r(y - 40)}, ${r(x + 280)} ${r(y + 30)}, 1360 690" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
      <g transform="translate(1390 690)" fill="none" stroke="${INK}" stroke-width="12">
        <circle cx="0" cy="0" r="26"/>
        <circle cx="0" cy="0" r="48"/>
        <circle cx="0" cy="0" r="70"/>
      </g>`;
  }
  return `<path d="M${r(x)} ${r(y)} L${r(x + 250)} ${r(y + 70)}" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>
    <circle cx="${r(x + 286)}" cy="${r(y + 78)}" r="30" fill="none" stroke="${INK}" stroke-width="14"/>`;
}

function groundMark(nose: Pt): string {
  const cx = Math.min(nose.x + 36, 1480);
  const cy = Math.min(Math.max(nose.y + 28, 700), 800);
  return `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="34" ry="12" fill="none" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="${r(cx)}" cy="${r(cy)}" rx="14" ry="5" fill="${INK}" fill-opacity="0.35"/>`;
}

function miniDog(): string {
  return `<g fill="${DOG}">
      <ellipse cx="230" cy="640" rx="72" ry="54"/>
      <rect x="196" y="668" width="30" height="92" rx="15"/>
      <rect x="248" y="676" width="26" height="84" rx="13"/>
      <circle cx="312" cy="575" r="48"/>
      <ellipse cx="368" cy="592" rx="38" ry="22"/>
      <ellipse cx="286" cy="530" rx="16" ry="36" transform="rotate(-18 286 530)"/>
    </g>
    <ellipse cx="398" cy="588" rx="9" ry="7" fill="${INK}"/>
    <path d="M292 562 Q314 580 336 562" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
}

function muzzleBasket(): string {
  return `<g transform="translate(1260 620)" fill="${INK}">
      <path fill-rule="evenodd" d="M0 0 h210 a40 40 0 0 1 0 80 H0 a30 30 0 0 1 0 -80z M90 40 m -20 0 a 20 20 0 1 1 40 0 a 20 20 0 1 1 -40 0z M160 40 m -20 0 a 20 20 0 1 1 40 0 a 20 20 0 1 1 -40 0z"/>
    </g>`;
}

function step(): string {
  return `<g transform="translate(1220 790)">
      <rect x="0" y="-78" width="280" height="78" rx="12" fill="${INK}"/>
      <rect x="46" y="-156" width="234" height="78" rx="12" fill="${INK2}"/>
    </g>`;
}

function oil(): string {
  return `<g transform="translate(1320 820)">
      <rect x="0" y="-200" width="86" height="200" rx="20" fill="${INK}"/>
      <rect x="18" y="-236" width="50" height="44" rx="12" fill="${INK2}"/>
      <rect x="18" y="-140" width="50" height="28" rx="6" fill="${DOG}"/>
      <path d="M130 -150 c0 0 42 48 42 78 a32 32 0 1 1 -64 0 c0 -30 22 -78 22 -78z" fill="${DOG}"/>
    </g>`;
}

function motifs(motivo: Motivo, dog: DogLayout): { back: string; front: string } {
  switch (motivo) {
    case 'comedero':
    case 'cuenco':
      return { back: '', front: bowl(1280, 800) };
    case 'bozal':
      return { back: '', front: muzzleBasket() };
    case 'cepillo':
      return { back: '', front: brush(1360, 800) };
    case 'cadera':
      return { back: '', front: hipMark(dog.hip) };
    case 'rampa':
      return { back: ramp(), front: '' };
    case 'casa':
      return { back: house(), front: '' };
    case 'chaleco-gotero':
      return { back: '', front: `${vest(1180, 800)}${dropper(1380, 800)}` };
    case 'saco-bote':
      return { back: '', front: `${bag(1140, 800)}${bottle(1360, 800)}` };
    case 'saco-gota':
      return { back: '', front: `${bag(1160, 800)}${droplet(1420, 800)}` };
    case 'marcas':
      return { back: '', front: scratchMarks(dog.neck) };
    case 'bote':
      return { back: '', front: bottle(1340, 800) };
    case 'pastilla':
      return { back: '', front: tablet(1380, 640) };
    case 'saco-cuenco':
      return { back: '', front: `${bag(1100, 800)}${bowl(1320, 810)}` };
    case 'cama':
      return { back: '', front: bed(1120, 800) };
    case 'aceite':
      return { back: '', front: oil() };
    case 'arnes':
      return { back: '', front: harness() };
    case 'ondas':
      return { back: waves(), front: '' };
    case 'estrellas':
      return { back: '', front: stars() };
    case 'tres-formatos':
      return {
        back: '',
        front: `${tablet(1220, 690)}${dropper(1310, 800)}${bone(1420, 700)}`,
      };
    case 'escalon':
      return { back: '', front: step() };
    case 'marca-suelo':
      return { back: '', front: groundMark(dog.nose) };
    case 'segundo-perro':
      return { back: miniDog(), front: '' };
    case 'cepillo-dientes':
      return { back: '', front: toothbrush(1180, 700) };
    case 'correa':
      return { back: '', front: leash(dog.neck, false) };
    case 'correa-larga':
      return { back: '', front: leash(dog.neck, true) };
    default:
      return assertNever(motivo);
  }
}

function assertNever(value: never): never {
  throw new Error(`Motivo o campo sin dibujo: ${String(value)}`);
}

export interface RenderBlogHeaderOptions {
  title: string;
  decorative?: boolean;
  og?: boolean;
}

function dogShift(motivo: Motivo): number {
  if (motivo === 'segundo-perro') return 180;
  if (motivo === 'casa' || motivo === 'rampa' || motivo === 'ondas') return 70;
  return 0;
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

function renderIllustration(slug: string, spec: IllustrationSpec, opts: RenderBlogHeaderOptions): string {
  const dog = drawDog(spec.silueta, spec.pose, dogShift(spec.motivo));
  const bits = motifs(spec.motivo, dog);
  const id = `ill-${slug}`;
  const labelled = opts.decorative ? 'aria-hidden="true"' : 'role="img"';
  const text = opts.decorative
    ? ''
    : `<title>${esc(opts.title)}</title><desc>${esc(spec.desc)}</desc>`;

  return svgShell(
    opts,
    labelled,
    text,
    `${field(spec.campo, id)}
    <ellipse cx="820" cy="812" rx="480" ry="28" fill="${INK}" fill-opacity="0.09"/>
    ${bits.back}
    ${dog.svg}
    ${bits.front}`,
  );
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
  const labelled = opts.decorative ? 'aria-hidden="true"' : 'role="img"';
  const text = opts.decorative
    ? ''
    : `<title>${esc(opts.title)}</title><desc>${esc(spec.desc)}</desc>`;

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

  return svgShell(
    opts,
    labelled,
    text,
    `${typographicField(spec.campo, id)}
    <text x="96" y="210" fill="${DOG}" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700" letter-spacing="0.14em">${esc(spec.eyebrow.toUpperCase())}</text>
    <rect x="96" y="228" width="72" height="4" rx="2" fill="${DOG}"/>
    <text fill="${INK}" font-family="Merriweather, Georgia, serif" font-size="${fontSize}" font-weight="900" letter-spacing="-0.02em">${tspans}</text>`,
  );
}

export function renderBlogHeader(slug: string, opts: RenderBlogHeaderOptions): string | null {
  if (!hasBlogHeader(slug)) return null;
  const spec: HeaderSpec = BLOG_HEADERS[slug];
  if (spec.style === 'typographic') return renderTypographic(slug, spec, opts);
  return renderIllustration(slug, spec, opts);
}

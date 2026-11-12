import fotos from '../data/fotos.json';

// Fotos de Pexels i Unsplash desades al web. Les afegeix `scripts/foto.py`,
// que n'apunta l'autor i la fitxa d'origen per mostrar-ne el crèdit.
export interface Foto {
  alt: string;
  autor: string;
  fuente: 'Pexels' | 'Unsplash';
  url: string;
  ancho: number;
  alto: number;
}

const FOTOS = fotos as Record<string, Foto>;

/** Crèdit d'una imatge local, o null si no és una foto del registre (p. ex. una il·lustració). */
export function fotoDe(src: string | null | undefined): Foto | null {
  return (src && FOTOS[src]) || null;
}

/** Com `fotoDe`, però una foto sense crèdit atura el build. */
export function fotoObligatoria(src: string, origen: string): Foto {
  const f = FOTOS[src];
  if (!f) throw new Error(`[fotos] «${src}» no és a src/data/fotos.json (${origen}): afegeix-la amb scripts/foto.py`);
  return f;
}

// Foto de capçalera de cada pàgina de categoria (/categoria/<slug>/).
export const FOTO_CATEGORIA: Record<string, string> = {
  'alimentacion-especifica': '/images/fotos/cuenco-pienso.webp',
  'ansiedad': '/images/blog/ansiedad-ruidos-perros-calmar-estres.webp',
  'arneses': '/images/fotos/labrador-arnes-parque.webp',
  'bozales': '/images/blog/bozales-perros-guia-elegir-talla.webp',
  'camas-ortopedicas': '/images/fotos/perro-mayor-cojin.webp',
  'condroprotectores': '/images/blog/mejor-condroprotector-perros-artrosis.webp',
  'correas': '/images/fotos/perros-correa-rio.webp',
  'digestion-sensible': '/images/blog/perro-diarrea-que-hacer-dieta.webp',
  'omega-3-y-aceite-de-salmon': '/images/fotos/cocker-pelo-brillante.webp',
  'incontinencia': '/images/blog/incontinencia-perro-mayor-panales.webp',
  'juguetes-interactivos': '/images/fotos/perro-entre-juguetes.webp',
  'piel-y-pelo': '/images/blog/como-evitar-que-mi-perro-suelte-pelo.webp',
  'movilidad-y-artrosis': '/images/blog/como-mejorar-movilidad-perro-mayor.webp',
  'paseos-seguros-y-control': '/images/fotos/perro-arnes-nieve.webp',
  'perros-senior': '/images/blog/condroprotectores-perros-guia-completa.webp',
  'problemas-renales-y-urinarios': '/images/blog/pienso-renal-perros-guia.webp',
  'rampas': '/images/blog/rampas-para-perros-beneficios.webp',
};

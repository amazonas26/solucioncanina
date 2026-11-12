import fuentes from '../data/fuentes.json';

export interface Fuente {
  autores: string;
  anio: number | null;
  titulo: string;
  publicacion: string;
  url: string;
  nota: string;
}

const LIB = fuentes as Record<string, Fuente>;

/** Resol els ids d'un article a fonts completes. Un id que no existeix atura el build. */
export function fuentesDe(ids: string[] | undefined, origen: string): Fuente[] {
  return (ids ?? []).map((id) => {
    const f = LIB[id];
    if (!f) throw new Error(`[fuentes] «${id}» no existeix a src/data/fuentes.json (${origen})`);
    return f;
  });
}

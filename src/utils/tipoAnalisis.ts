export const TIPOS_ANALISIS = [
  'Probado en casa',
  'Analizado',
  'Pendiente',
] as const;

export type TipoAnalisis = (typeof TIPOS_ANALISIS)[number];

export const TIPO_ANALISIS_DEFAULT: TipoAnalisis = 'Analizado';

export const TIPO_ANALISIS_ANCHOR: Record<TipoAnalisis, string> = {
  'Probado en casa': 'probado-en-casa',
  Analizado: 'analizado',
  Pendiente: 'pendiente',
};

export const COMO_ANALIZAMOS_PATH = '/como-analizamos/';

export function tipoAnalisisHref(
  tipo: TipoAnalisis = TIPO_ANALISIS_DEFAULT,
): string {
  return `${COMO_ANALIZAMOS_PATH}#${TIPO_ANALISIS_ANCHOR[tipo]}`;
}

export const TIPO_ANALISIS_BADGE_CLASS: Record<TipoAnalisis, string> = {
  'Probado en casa': 'text-primary-700 decoration-primary-300 hover:decoration-primary-600',
  Analizado: 'text-neutral-600 decoration-neutral-300 hover:text-primary-700 hover:decoration-primary-400',
  Pendiente: 'text-amber-800 decoration-amber-300 hover:decoration-amber-600',
};

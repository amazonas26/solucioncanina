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
  'Probado en casa':
    'bg-primary-50 text-primary-800 border-primary-100 hover:border-primary-300',
  Analizado:
    'bg-white text-neutral-700 border-neutral-200 hover:border-primary-200 hover:text-primary-700',
  Pendiente:
    'bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-300',
};

export const HERRAMIENTAS_PATH = '/herramientas/';

export interface HerramientaInput {
  label: string;
  unit?: string;
}

export type HerramientaAccent = 'teal' | 'navy' | 'mint' | 'sky' | 'forest' | 'warm';

export interface Herramienta {
  id: string;
  nombre: string;
  breadcrumb: string;
  href: string;
  pregunta: string;
  paraQue: string;
  inputs: string;
  inputLabels: HerramientaInput[];
  paraQuien: string;
  accent: HerramientaAccent;
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    id: 'condroprotector',
    nombre: 'Calculadora de dosis de condroprotector',
    breadcrumb: 'Dosis de condroprotector',
    href: '/calculadora-dosis-condroprotector-perros/',
    pregunta: '¿Qué dosis de condroprotector necesita mi perro?',
    accent: 'teal',
    paraQue:
      'Saber cuánta glucosamina, condroitina y MSM debe cubrir el bote, para comparar dosis activa y no el precio del envase.',
    inputs: 'Peso del perro, etapa (prevención, sénior o artrosis) y si aplica dosis de carga.',
    inputLabels: [
      { label: 'Peso', unit: 'kg' },
      { label: 'Situación' },
      { label: 'Carga' },
    ],
    paraQuien:
      'Dueños que eligen condroprotector y no quieren pagar un bote barato que obliga a dar seis comprimidos al día.',
  },
  {
    id: 'bozal',
    nombre: 'Calculadora de talla de bozal',
    breadcrumb: 'Talla de bozal',
    href: '/calculadora-talla-bozal-perros/',
    pregunta: '¿Qué talla de bozal necesita mi perro?',
    accent: 'navy',
    paraQue:
      'Traducir perímetro y longitud del hocico a una talla orientativa y a un tipo (cesta o silicona) que deje jadear y beber.',
    inputs: 'Perímetro del hocico, longitud del hocico y si el perro es braquicéfalo.',
    inputLabels: [
      { label: 'Perímetro', unit: 'cm' },
      { label: 'Longitud', unit: 'cm' },
      { label: 'Hocico' },
    ],
    paraQuien:
      'Quien necesita bozal para el veterinario, el transporte o paseos con perros reactivos y no quiere apretar el hocico.',
  },
  {
    id: 'cama',
    nombre: 'Calculadora de talla de cama',
    breadcrumb: 'Talla de cama',
    href: '/calculadora-talla-cama-ortopedica-perros/',
    pregunta: '¿Qué talla de cama necesita mi perro?',
    accent: 'mint',
    paraQue:
      'Traducir cómo medir a tu perro para la cama (hocico a cola) a talla: largo +30 cm, ancho según postura y grosor de espuma.',
    inputs: 'Longitud de hocico a base de la cola, peso y postura habitual de sueño.',
    inputLabels: [
      { label: 'Longitud', unit: 'cm' },
      { label: 'Peso', unit: 'kg' },
      { label: 'Postura' },
    ],
    paraQuien:
      'Quien va a comprar cama y no quiere quedarse corto de talla: medir al perro, no adivinar una S/M/L.',
  },
  {
    id: 'rampa',
    nombre: 'Calculadora de medida de rampa',
    breadcrumb: 'Medida de rampa',
    href: '/calculadora-medida-rampa-perros/',
    pregunta: '¿Qué medida de rampa necesita mi perro?',
    accent: 'warm',
    paraQue:
      'Obtener la longitud mínima con pendiente segura y la capacidad de carga, o pasar a escalera si no cabe.',
    inputs: 'Altura del sofá, cama o maletero, peso del perro y perfil (adulto, senior o espalda larga).',
    inputLabels: [
      { label: 'Altura', unit: 'cm' },
      { label: 'Peso', unit: 'kg' },
      { label: 'Perfil' },
    ],
    paraQuien:
      'Quien quiere que el perro suba al coche o al sofá sin forzar hombros y columna, sobre todo con artrosis.',
  },
  {
    id: 'arnes',
    nombre: 'Calculadora de talla de arnés o collar',
    breadcrumb: 'Talla de arnés o collar',
    href: '/calculadora-talla-arnes-collar-perros/',
    pregunta: '¿Qué talla de arnés o collar necesita mi perro?',
    accent: 'sky',
    paraQue:
      'Traducir perímetro de cuello y pecho a talla de collar y de arnés; el peso solo comprueba que no hayas medido mal.',
    inputs: 'Perímetro del cuello, perímetro del pecho y peso.',
    inputLabels: [
      { label: 'Cuello', unit: 'cm' },
      { label: 'Pecho', unit: 'cm' },
      { label: 'Peso', unit: 'kg' },
    ],
    paraQuien:
      'Quien va a comprar arnés o collar y no quiere una talla que roce el cuello o se escape por el pecho.',
  },
  {
    id: 'renal',
    nombre: 'Calculadora de ración de pienso renal',
    breadcrumb: 'Ración de pienso renal',
    href: '/calculadora-racion-pienso-renal-perros/',
    pregunta: '¿Cuánto pienso renal le doy a mi perro?',
    accent: 'forest',
    paraQue:
      'Orientar los gramos diarios de pienso renal seco según peso y actividad. La pauta la marca el veterinario.',
    inputs: 'Peso del perro y nivel de actividad.',
    inputLabels: [
      { label: 'Peso', unit: 'kg' },
      { label: 'Actividad' },
    ],
    paraQuien:
      'Dueños con dieta renal ya prescrita que quieren una cifra de partida para la cantidad, no un diagnóstico.',
  },
];

export function herramientaByHref(href: string): Herramienta | undefined {
  const clean = href.endsWith('/') ? href : `${href}/`;
  return HERRAMIENTAS.find((h) => h.href === clean);
}

export function otrasHerramientas(currentHref: string): Herramienta[] {
  const clean = currentHref.endsWith('/') ? currentHref : `${currentHref}/`;
  return HERRAMIENTAS.filter((h) => h.href !== clean);
}

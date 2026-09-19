export const HERRAMIENTAS_PATH = '/herramientas/';

export interface Herramienta {
  id: string;
  nombre: string;
  breadcrumb: string;
  href: string;
  paraQue: string;
  inputs: string;
  paraQuien: string;
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    id: 'condroprotector',
    nombre: 'Calculadora de dosis de condroprotector',
    breadcrumb: 'Dosis de condroprotector',
    href: '/calculadora-dosis-condroprotector-perros/',
    paraQue:
      'Saber cuánta glucosamina, condroitina y MSM debe cubrir el bote, para comparar dosis activa y no el precio del envase.',
    inputs: 'Peso del perro, etapa (prevención, sénior o artrosis) y si aplica dosis de carga.',
    paraQuien:
      'Dueños que eligen condroprotector y no quieren pagar un bote barato que obliga a dar seis comprimidos al día.',
  },
  {
    id: 'bozal',
    nombre: 'Calculadora de talla de bozal',
    breadcrumb: 'Talla de bozal',
    href: '/calculadora-talla-bozal-perros/',
    paraQue:
      'Traducir perímetro y longitud del hocico a una talla orientativa y a un tipo (cesta o silicona) que deje jadear y beber.',
    inputs: 'Perímetro del hocico, longitud del hocico y si el perro es braquicéfalo.',
    paraQuien:
      'Quien necesita bozal para el veterinario, el transporte o paseos con perros reactivos y no quiere apretar el hocico.',
  },
  {
    id: 'cama',
    nombre: 'Calculadora de talla de cama',
    breadcrumb: 'Talla de cama',
    href: '/calculadora-talla-cama-ortopedica-perros/',
    paraQue:
      'Traducir cómo medir a tu perro para la cama (hocico a cola) a talla: largo +30 cm, ancho según postura y grosor de espuma.',
    inputs: 'Longitud de hocico a base de la cola, peso y postura habitual de sueño.',
    paraQuien:
      'Quien va a comprar cama y no quiere quedarse corto de talla: medir al perro, no adivinar una S/M/L.',
  },
  {
    id: 'rampa',
    nombre: 'Calculadora de medida de rampa',
    breadcrumb: 'Medida de rampa',
    href: '/calculadora-medida-rampa-perros/',
    paraQue:
      'Obtener la longitud mínima con pendiente segura y la capacidad de carga, o pasar a escalera si no cabe.',
    inputs: 'Altura del sofá, cama o maletero, peso del perro y perfil (adulto, senior o espalda larga).',
    paraQuien:
      'Quien quiere que el perro suba al coche o al sofá sin forzar hombros y columna, sobre todo con artrosis.',
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

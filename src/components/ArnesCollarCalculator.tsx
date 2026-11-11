import React, { useMemo, useState } from 'react';
import { Calculator, Ruler, Scale, ArrowRight, Star, AlertTriangle, Info } from 'lucide-react';
import type { CalcProducto } from './CondroprotectorCalculator';
import { notaPrecios } from '../utils/precioConsultado';

interface Props {
  productos: CalcProducto[];
}

interface TallaRango {
  label: string;
  min: number;
  max: number;
}

// Collar: perímetro de cuello del perro (no la longitud máxima de la cinta).
// En el límite exacto entre filas, sube de talla: un collar justo presiona tráquea.
const TALLAS_COLLAR: TallaRango[] = [
  { label: 'XS', min: 18, max: 26 },
  { label: 'S', min: 26, max: 35 },
  { label: 'M', min: 35, max: 45 },
  { label: 'L', min: 45, max: 56 },
  { label: 'XL', min: 56, max: 80 },
];

// Arnés en Y: criterio principal = perímetro de pecho (detrás de las patas delanteras).
const TALLAS_ARNES: TallaRango[] = [
  { label: 'XS', min: 30, max: 43 },
  { label: 'S', min: 43, max: 53 },
  { label: 'M', min: 53, max: 68 },
  { label: 'L', min: 68, max: 85 },
  { label: 'XL', min: 85, max: 120 },
];

// Peso solo como comprobación: si discrepa dos tallas del pecho, hay que volver a medir.
const TALLAS_PESO: { label: string; min: number; max: number }[] = [
  { label: 'XS', min: 2, max: 7 },
  { label: 'S', min: 6, max: 14 },
  { label: 'M', min: 12, max: 25 },
  { label: 'L', min: 22, max: 40 },
  { label: 'XL', min: 35, max: 90 },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function tallaPorRango(valor: number, tabla: TallaRango[]): TallaRango {
  for (let i = 0; i < tabla.length; i++) {
    const row = tabla[i];
    const next = tabla[i + 1];
    if (valor >= row.min && valor < row.max) return row;
    if (next && valor === row.max) return next;
    if (!next && valor >= row.min && valor <= row.max) return row;
  }
  return valor < tabla[0].min ? tabla[0] : tabla[tabla.length - 1];
}

function tallaPorPeso(peso: number): string {
  for (let i = 0; i < TALLAS_PESO.length; i++) {
    const row = TALLAS_PESO[i];
    const next = TALLAS_PESO[i + 1];
    if (peso >= row.min && peso < row.max) return row.label;
    if (next && peso === row.max) return next.label;
    if (!next && peso >= row.min && peso <= row.max) return row.label;
  }
  return peso < TALLAS_PESO[0].min ? TALLAS_PESO[0].label : TALLAS_PESO[TALLAS_PESO.length - 1].label;
}

const ORDEN = ['XS', 'S', 'M', 'L', 'XL'];

export interface ArnesCollarResultado {
  collar: TallaRango;
  arnes: TallaRango;
  tallaPeso: string;
  avisoMedida: string | null;
  discrepaPeso: boolean;
}

export function calcArnesCollar(
  cuello: number,
  pecho: number,
  peso: number,
): ArnesCollarResultado {
  const collar = tallaPorRango(cuello, TALLAS_COLLAR);
  const arnes = tallaPorRango(pecho, TALLAS_ARNES);
  const tallaPeso = tallaPorPeso(peso);
  let avisoMedida: string | null = null;

  if (pecho < cuello) {
    avisoMedida =
      'El pecho no puede medir menos que el cuello. Vuelve a medir: cuello en la base (donde iría el collar) y pecho justo detrás de las patas delanteras, con el perro de pie.';
  } else if (cuello > pecho * 0.85) {
    avisoMedida =
      'Cuello y pecho salen demasiado parecidos. Suele indicar que el metro quedó alto en el pecho o bajo en el cuello. Vuelve a medir antes de comprar.';
  }

  const idxArnes = ORDEN.indexOf(arnes.label);
  const idxPeso = ORDEN.indexOf(tallaPeso);
  const discrepaPeso = Math.abs(idxArnes - idxPeso) >= 2;

  if (!avisoMedida && discrepaPeso) {
    avisoMedida =
      'El peso apunta a otra talla que el pecho. Para el arnés, fíate del perímetro de pecho, no de los kilos. Vuelve a medir si el perro está entre dos extremos (cachorro en crecimiento o raza muy profunda de pecho).';
  }

  return { collar, arnes, tallaPeso, avisoMedida, discrepaPeso };
}

export default function ArnesCollarCalculator({ productos }: Props) {
  const [cuello, setCuello] = useState(40);
  const [pecho, setPecho] = useState(65);
  const [peso, setPeso] = useState(20);

  const result = useMemo(() => calcArnesCollar(cuello, pecho, peso), [cuello, pecho, peso]);
  const recomendados = productos.slice(0, 4);
  const notaRecomendados = notaPrecios(recomendados.map((p) => p.slug));

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de talla de arnés o collar</h2>
      </div>

      <div className="p-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="cuello-arnes" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Ruler size={16} className="text-primary-600" /> Perímetro del cuello
            </label>
            <div className="flex items-center gap-4">
              <input
                id="cuello-arnes"
                type="range"
                min={18}
                max={80}
                step={1}
                value={cuello}
                onChange={(e) => setCuello(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="cuello-arnes-val"
              />
              <span id="cuello-arnes-val" className="shrink-0 w-24 text-right">
                <input
                  type="number"
                  min={18}
                  max={80}
                  value={cuello}
                  onChange={(e) => setCuello(clamp(Number(e.target.value) || 18, 18, 80))}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Perímetro del cuello en centímetros"
                />
                <span className="ml-1 text-sm text-neutral-500">cm</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              En la base del cuello, donde iría el collar. Metro horizontal, perro de pie.
            </p>
          </div>

          <div>
            <label htmlFor="pecho-arnes" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Ruler size={16} className="text-primary-600" /> Perímetro del pecho
            </label>
            <div className="flex items-center gap-4">
              <input
                id="pecho-arnes"
                type="range"
                min={30}
                max={120}
                step={1}
                value={pecho}
                onChange={(e) => setPecho(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="pecho-arnes-val"
              />
              <span id="pecho-arnes-val" className="shrink-0 w-24 text-right">
                <input
                  type="number"
                  min={30}
                  max={120}
                  value={pecho}
                  onChange={(e) => setPecho(clamp(Number(e.target.value) || 30, 30, 120))}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Perímetro del pecho en centímetros"
                />
                <span className="ml-1 text-sm text-neutral-500">cm</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Justo detrás de las patas delanteras, en el punto más ancho. Es la cifra del arnés.
            </p>
          </div>

          <div>
            <label htmlFor="peso-arnes" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Scale size={16} className="text-primary-600" /> Peso del perro
            </label>
            <div className="flex items-center gap-4">
              <input
                id="peso-arnes"
                type="range"
                min={2}
                max={80}
                step={1}
                value={peso}
                onChange={(e) => setPeso(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="peso-arnes-val"
              />
              <span id="peso-arnes-val" className="shrink-0 w-24 text-right">
                <input
                  type="number"
                  min={2}
                  max={80}
                  value={peso}
                  onChange={(e) => setPeso(clamp(Number(e.target.value) || 2, 2, 80))}
                  className="w-14 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Peso en kilogramos"
                />
                <span className="ml-1 text-sm text-neutral-500">kg</span>
              </span>
            </div>
            <p className="mt-2 flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
              <span>
                El peso no elige la talla: solo avisa si no encaja con el pecho. Un «M» de Julius-K9 no
                es el «M» de otra marca; confirma centímetros en la ficha.
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Resultado orientativo
          </p>

          <div>
            <p className="text-sm text-neutral-600 mb-1">Talla de collar</p>
            <p className="text-3xl font-black text-neutral-900 tracking-tight">
              {result.collar.label}{' '}
              <span className="text-lg font-bold text-primary-700">
                ({result.collar.min}–{result.collar.max} cm de cuello)
              </span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Ajusta para que quepan dos dedos (~2–3 cm). Un collar justo presiona tráquea al tirar.
            </p>
          </div>

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-sm text-neutral-600 mb-1">Talla de arnés</p>
            <p className="text-3xl font-black text-neutral-900 tracking-tight">
              {result.arnes.label}{' '}
              <span className="text-lg font-bold text-primary-700">
                ({result.arnes.min}–{result.arnes.max} cm de pecho)
              </span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Prioriza arnés en Y si tira o es braquicéfalo. El peso apunta a talla {result.tallaPeso}.
            </p>
          </div>

          {result.avisoMedida && (
            <p className="flex gap-2 text-xs leading-relaxed text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{result.avisoMedida}</span>
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-neutral-400">
            Si dudas entre dos tallas comerciales, elige la superior. Nunca bajes de talla «por si
            acaso»: un arnés pequeño roza axilas y un collar pequeño ahoga.
          </p>
        </div>
      </div>

      {recomendados.length > 0 && (
        <div className="border-t border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">
            Arneses y correas mejor valorados que hemos analizado
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {recomendados.map((p) => (
              <a
                key={p.slug}
                href={`/producto/${p.slug}/`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-neutral-800 group-hover:text-primary-600 transition-colors">
                    {p.titulo}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-neutral-500">
                    {p.valoracion > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Star size={12} className="fill-amber-400 text-amber-400" /> {p.valoracion}
                      </span>
                    )}
                    {p.precio && <span>· {p.precio}</span>}
                  </span>
                </span>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-primary-500 transition-transform group-hover:translate-x-1"
                />
              </a>
            ))}
          </div>
          {notaRecomendados && (
            <p className="mt-3 text-[11px] text-neutral-400">{notaRecomendados}</p>
          )}
          <a
            href="/categoria/correas/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
          >
            Ver todas las correas y arneses analizados <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Calculator, Scale, ArrowRight, Star, AlertTriangle, Info } from 'lucide-react';
import type { CalcProducto } from './CondroprotectorCalculator';
import { notaPrecios } from '../utils/precioConsultado';
import NumberInput from './NumberInput';

interface Props {
  productos: CalcProducto[];
}

type Actividad = 'sedentario' | 'moderado' | 'activo';

interface ActividadInfo {
  id: Actividad;
  label: string;
  factor: number;
  nota: string;
}

// RER (NRC 2006) = 70 × peso^0,75. DER = RER × factor de actividad.
// Gramos de pienso seco renal típico (~390 kcal/100 g; rango 370–410).
const ACTIVIDADES: ActividadInfo[] = [
  {
    id: 'sedentario',
    label: 'Poco activo',
    factor: 1.2,
    nota: 'Castrado, paseos cortos o vida muy casera. Si el veterinario usa peso ideal (sobrepeso), introduce ese peso, no el actual.',
  },
  {
    id: 'moderado',
    label: 'Moderado',
    factor: 1.4,
    nota: 'Paseos diarios sin deporte intenso. Es el punto de partida más habitual en adultos con dieta renal prescrita.',
  },
  {
    id: 'activo',
    label: 'Activo',
    factor: 1.6,
    nota: 'Mucho paseo o trabajo. En insuficiencia renal avanzada el veterinario suele bajar, no subir: no uses este perfil sin su visto bueno.',
  },
];

const KCAL_POR_100G = 390;
const KCAL_MIN = 370;
const KCAL_MAX = 410;

function rerKcal(peso: number): number {
  return 70 * Math.pow(peso, 0.75);
}

export interface RacionRenalResultado {
  rer: number;
  der: number;
  gramos: number;
  gramosMin: number;
  gramosMax: number;
  tomas: number;
  gramosPorToma: number;
  factor: number;
}

export function calcRacionRenal(peso: number, actividad: Actividad): RacionRenalResultado {
  const info = ACTIVIDADES.find((a) => a.id === actividad)!;
  const rer = rerKcal(peso);
  const der = rer * info.factor;
  const gramos = Math.round(der / (KCAL_POR_100G / 100));
  const gramosMin = Math.round(der / (KCAL_MAX / 100));
  const gramosMax = Math.round(der / (KCAL_MIN / 100));
  const tomas = peso < 10 ? 3 : 2;
  const gramosPorToma = Math.round(gramos / tomas);
  return {
    rer: Math.round(rer),
    der: Math.round(der),
    gramos,
    gramosMin,
    gramosMax,
    tomas,
    gramosPorToma,
    factor: info.factor,
  };
}

const fmt = (n: number) => n.toLocaleString('es-ES');

export default function PiensoRenalCalculator({ productos }: Props) {
  const [peso, setPeso] = useState(15);
  const [actividad, setActividad] = useState<Actividad>('moderado');

  const result = useMemo(() => calcRacionRenal(peso, actividad), [peso, actividad]);
  const actividadInfo = ACTIVIDADES.find((a) => a.id === actividad)!;
  const recomendados = productos.slice(0, 4);
  const notaRecomendados = notaPrecios(recomendados.map((p) => p.slug));

  return (
    <div className="border border-neutral-900 bg-white overflow-hidden">
      <div className="bg-navy-800 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de ración de pienso renal</h2>
      </div>

      <div className="mx-6 mt-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <AlertTriangle size={20} className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
        <p className="text-sm leading-relaxed">
          <strong className="font-black">La pauta la marca el veterinario.</strong> Esta calculadora
          solo orienta sobre la <strong>cantidad</strong> de pienso seco. Nunca indica si el pienso
          es adecuado para tu perro, ni sustituye el diagnóstico, el estadio ni el saco que te hayan
          prescrito.
        </p>
      </div>

      <div className="p-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="peso-renal" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Scale size={16} className="text-primary-600" /> Peso del perro
            </label>
            <div className="flex items-center gap-4">
              <input
                id="peso-renal"
                type="range"
                min={2}
                max={70}
                step={0.5}
                value={peso}
                onChange={(e) => setPeso(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="peso-renal-val"
              />
              <span id="peso-renal-val" className="shrink-0 w-24 text-right">
                <NumberInput
                  min={2}
                  max={70}
                  value={peso}
                  onValueChange={setPeso}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Peso en kilogramos"
                />
                <span className="ml-1 text-sm text-neutral-500">kg</span>
              </span>
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-neutral-800 mb-2">Nivel de actividad</span>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVIDADES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActividad(a.id)}
                  aria-pressed={actividad === a.id}
                  className={
                    'rounded-lg border px-2 py-2 text-xs font-bold transition-colors ' +
                    (actividad === a.id
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
            <p className="mt-2 flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
              <span>{actividadInfo.nota}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Cantidad orientativa · pienso seco · {peso.toLocaleString('es-ES')} kg
          </p>

          <div>
            <p className="text-sm text-neutral-600 mb-1">Ración diaria</p>
            <p className="text-3xl font-black text-neutral-900 tracking-tight">
              {fmt(result.gramos)}{' '}
              <span className="text-xl text-primary-700">g</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Rango según densidad del saco ({KCAL_MIN}–{KCAL_MAX} kcal/100 g): {fmt(result.gramosMin)}–
              {fmt(result.gramosMax)} g.
            </p>
          </div>

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-sm text-neutral-600 mb-1">Cómo repartirla</p>
            <p className="font-black text-neutral-900 text-xl">
              {result.tomas} tomas · {fmt(result.gramosPorToma)} g cada una
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              En náuseas, el veterinario suele preferir más tomas pequeñas, no una ración más grande.
            </p>
          </div>

          <ul className="text-[11px] leading-relaxed text-neutral-400 space-y-1">
            <li>Energía de mantenimiento (DER): {fmt(result.der)} kcal/día (RER {fmt(result.rer)} × {result.factor.toLocaleString('es-ES')}).</li>
            <li>No aplica a húmedo: el paté renal ronda ~100 kcal/100 g, así que los gramos no sirven.</li>
          </ul>
        </div>
      </div>

      {recomendados.length > 0 && (
        <div className="border-t border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">
            Piensos renales mejor valorados que hemos analizado
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
            href="/categoria/alimentacion-especifica/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
          >
            Ver toda la alimentación específica analizada <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

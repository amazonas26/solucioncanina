import React, { useMemo, useState } from 'react';
import { Calculator, Dog, ArrowRight, Star, Info } from 'lucide-react';
import { notaPrecios } from '../utils/precioConsultado';

export interface CalcProducto {
  slug: string;
  titulo: string;
  marca: string;
  precio: string;
  valoracion: number;
  imagen?: string;
}

interface Props {
  productos: CalcProducto[];
}

type Etapa = 'prevencion' | 'senior' | 'artrosis';

interface Dose {
  gluco: string;
  condro: string;
  msm: string;
}

// Dosis calculadas por peso vivo, según rangos de referencia veterinarios:
//  · Glucosamina: 20-40 mg/kg/día
//  · Condroitina: 15-30 mg/kg/día (reducir a la mitad tras 6 semanas)
//  · MSM:         50-100 mg/kg/día (rango terapéutico estudiado)
// Fuentes: PetPlace (Cosequin), Pawlicy Advisor, VitaDog. Detalle citado en la página.
const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
function getDose(peso: number, carga: boolean): Dose {
  const k = carga ? 2 : 1; // dosis de carga = doble durante 4-6 semanas
  return {
    gluco: `${fmt(peso * 20 * k)}–${fmt(peso * 40 * k)}`,
    condro: `${fmt(peso * 15 * k)}–${fmt(peso * 30 * k)}`,
    msm: `${fmt(peso * 50)}–${fmt(peso * 100)}`,
  };
}

// Rang diari (mg) d'un principi actiu per pes, amb o sense dosi de carga.
type Principio = 'gluco' | 'condro';
const RANGO_MG_KG: Record<Principio, [number, number]> = { gluco: [20, 40], condro: [15, 30] };
function rangoMg(peso: number, principio: Principio, carga: boolean): [number, number] {
  const k = carga ? 2 : 1;
  const [min, max] = RANGO_MG_KG[principio];
  return [peso * min * k, peso * max * k];
}

// Unitats al dia (comprimits, masticables o ml) en mitges unitats: el mínim s'arrodoneix
// cap amunt (per arribar a la dosi mínima) i el màxim cap avall (per no passar-se'n).
const unidadesMin = (mg: number, mgPorUnidad: number) => Math.max(0.5, Math.ceil((mg / mgPorUnidad) * 2) / 2);
const unidadesMax = (mg: number, mgPorUnidad: number) => Math.floor((mg / mgPorUnidad) * 2) / 2;
const fmtUnidades = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

const ETAPAS: { id: Etapa; label: string; nota: string }[] = [
  {
    id: 'prevencion',
    label: 'Prevención',
    nota: 'En razas grandes o con predisposición, lo razonable es empezar a partir de los 4-5 años, sin esperar a la primera cojera. La prevención es mucho más efectiva que el tratamiento tardío.',
  },
  {
    id: 'senior',
    label: 'Perro sénior',
    nota: 'A partir de los 7-8 años, como soporte de fondo continuo. Mantén la dosis dentro del rango y dale tiempo: los efectos se notan a las 4-6 semanas.',
  },
  {
    id: 'artrosis',
    label: 'Con artrosis',
    nota: 'Con artrosis diagnosticada, el condroprotector es un complemento del tratamiento veterinario, no un sustituto. Conviene apuntar a la parte alta del rango de dosis y mantenerlo de forma continua.',
  },
];

export default function CondroprotectorCalculator({ productos }: Props) {
  const [peso, setPeso] = useState<number>(20);
  const [etapa, setEtapa] = useState<Etapa>('senior');
  const [carga, setCarga] = useState<boolean>(false);
  const [principio, setPrincipio] = useState<Principio>('gluco');
  const [mgPorUnidad, setMgPorUnidad] = useState<string>('');

  const dose = useMemo(() => getDose(peso, carga), [peso, carga]);
  const etapaInfo = ETAPAS.find((e) => e.id === etapa)!;
  const mgUnidad = Number(mgPorUnidad.replace(',', '.'));
  const tuProducto = useMemo(() => {
    if (!(mgUnidad > 0)) return null;
    const [min, max] = rangoMg(peso, principio, carga);
    const desde = unidadesMin(min, mgUnidad);
    const hasta = unidadesMax(max, mgUnidad);
    // Producte tan concentrat que ni mitja unitat cap dins del rang.
    return { min: desde, max: Math.max(desde, hasta), excede: hasta < desde };
  }, [peso, principio, carga, mgUnidad]);

  // Recomendamos los 4 mejor valorados (los productos ya vienen ordenados).
  const recomendados = productos.slice(0, 4);
  const notaRecomendados = notaPrecios(recomendados.map((p) => p.slug));

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de dosis de condroprotector</h2>
      </div>

      <div className="p-6 grid gap-6 md:grid-cols-2">
        {/* Controles */}
        <div className="space-y-6">
          <div>
            <label htmlFor="peso" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Dog size={16} className="text-primary-600" /> Peso del perro
            </label>
            <div className="flex items-center gap-4">
              <input
                id="peso"
                type="range"
                min={2}
                max={70}
                step={1}
                value={peso}
                onChange={(e) => setPeso(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="peso-val"
              />
              <span id="peso-val" className="shrink-0 w-20 text-right">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={peso}
                  onChange={(e) => setPeso(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                  className="w-14 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Peso en kilogramos"
                />
                <span className="ml-1 text-sm text-neutral-500">kg</span>
              </span>
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-neutral-800 mb-2">Situación</span>
            <div className="grid grid-cols-3 gap-2">
              {ETAPAS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEtapa(e.id)}
                  aria-pressed={etapa === e.id}
                  className={
                    'rounded-lg border px-2 py-2 text-xs font-bold transition-colors ' +
                    (etapa === e.id
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3 cursor-pointer hover:border-neutral-300">
            <input
              type="checkbox"
              checked={carga}
              onChange={(e) => setCarga(e.target.checked)}
              className="mt-0.5 accent-primary-600"
            />
            <span className="text-xs leading-relaxed text-neutral-600">
              <strong className="text-neutral-800">Dosis de carga</strong> (primeras 4-6 semanas):
              dobla glucosamina y condroitina para alcanzar niveles antes; luego pasa a mantenimiento.
            </span>
          </label>

          <p className="flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
            <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
            <span>{etapaInfo.nota}</span>
          </p>
        </div>

        {/* Resultado */}
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-3">
            Dosis orientativa diaria · {peso} kg{carga ? ' · con carga' : ''}
          </p>
          <ul className="space-y-3">
            <li className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <span className="text-sm text-neutral-600">Glucosamina</span>
              <span className="font-black text-neutral-900">{dose.gluco} mg</span>
            </li>
            <li className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <span className="text-sm text-neutral-600">Condroitina</span>
              <span className="font-black text-neutral-900">{dose.condro} mg</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">MSM</span>
              <span className="font-black text-neutral-900">{dose.msm} mg</span>
            </li>
          </ul>
          <div className="mt-5 border-t border-neutral-200 pt-4">
            <p className="text-sm font-bold text-neutral-800 mb-2">Con tu producto</p>
            <div className="flex gap-2 mb-2" role="group" aria-label="Qué indica la etiqueta">
              {([['gluco', 'Glucosamina'], ['condro', 'Condroitina']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrincipio(id)}
                  aria-pressed={principio === id}
                  className={
                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ' +
                    (principio === id
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <label htmlFor="mg-unidad" className="block text-xs text-neutral-600 mb-1">
              mg por comprimido, masticable o ml (lo pone la etiqueta)
            </label>
            <input
              id="mg-unidad"
              type="number"
              inputMode="decimal"
              min={1}
              placeholder="p. ej. 500"
              value={mgPorUnidad}
              onChange={(e) => setMgPorUnidad(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-900"
            />
            {tuProducto ? (
              <p className="mt-3 text-sm text-neutral-700" aria-live="polite">
                <strong className="text-neutral-900">
                  {tuProducto.min === tuProducto.max
                    ? fmtUnidades(tuProducto.min)
                    : `${fmtUnidades(tuProducto.min)} a ${fmtUnidades(tuProducto.max)}`}{' '}
                  al día
                </strong>{' '}
                para cubrir la {principio === 'gluco' ? 'glucosamina' : 'condroitina'} de un perro de {peso} kg
                {carga ? ' durante la carga' : ''}.
                {tuProducto.excede && (
                  <span className="block mt-1 text-xs text-amber-700">
                    Con esta concentración, incluso media unidad supera el rango para su peso:
                    sigue la pauta de la etiqueta o consúltalo con tu veterinario.
                  </span>
                )}
                {tuProducto.max > 6 && (
                  <span className="block mt-1 text-xs text-amber-700">
                    Más de 6 al día es difícil de mantener: busca un producto más concentrado.
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-neutral-400">
                Introduce los mg y te decimos cuántas unidades al día necesita.
              </p>
            )}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
            Orientativo, no sustituye el consejo veterinario. Si la etiqueta o tu veterinario
            dan una pauta por peso, esa manda.
          </p>
        </div>
      </div>

      {/* Productos recomendados */}
      {recomendados.length > 0 && (
        <div className="border-t border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">
            Condroprotectores mejor valorados que hemos analizado
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
                <ArrowRight size={16} className="shrink-0 text-primary-500 transition-transform group-hover:translate-x-1" />
              </a>
            ))}
          </div>
          {notaRecomendados && (
            <p className="mt-3 text-[11px] text-neutral-400">{notaRecomendados}</p>
          )}
          <a
            href="/categoria/condroprotectores/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
          >
            Ver todos los condroprotectores analizados <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Calculator, Ruler, Scale, ArrowRight, Star, AlertTriangle, Info } from 'lucide-react';
import type { CalcProducto } from './CondroprotectorCalculator';
import { notaPrecios } from '../utils/precioConsultado';
import NumberInput from './NumberInput';

interface Props {
  productos: CalcProducto[];
}

type Perfil = 'adulto' | 'senior' | 'espalda';

interface PerfilInfo {
  id: Perfil;
  label: string;
  angulo: number;
  nota: string;
}

// Ángulos seguros aprobados: L = H / sin(θ), redondeado al alza a múltiplos de 5 cm.
const PERFILES: PerfilInfo[] = [
  {
    id: 'adulto',
    label: 'Adulto sano',
    angulo: 25,
    nota: 'Pendiente más corta; solo si el perro sube con seguridad y sin rechazar la rampa.',
  },
  {
    id: 'senior',
    label: 'Senior / artrosis',
    angulo: 21,
    nota: 'Equilibrio entre longitud manejable y pendiente suave. Recomendado por defecto.',
  },
  {
    id: 'espalda',
    label: 'Espalda larga',
    angulo: 18,
    nota: 'Teckel, corgi, basset… Prioriza pendiente suave; si L supera 200 cm, mejor escalera.',
  },
];

const PRESETS_ALTURA: { label: string; cm: number }[] = [
  { label: 'Sofá', cm: 45 },
  { label: 'Cama', cm: 55 },
  { label: 'Maletero', cm: 65 },
  { label: 'SUV', cm: 75 },
];

function roundUp5(n: number) {
  return Math.ceil(n / 5) * 5;
}

export interface RampaResultado {
  angulo: number;
  longitudMin: number;
  capacidadMin: number;
  recomiendaEscalera: boolean;
}

export function calcRampa(altura: number, peso: number, perfil: Perfil): RampaResultado {
  const info = PERFILES.find((p) => p.id === perfil)!;
  const rad = (info.angulo * Math.PI) / 180;
  const longitudMin = roundUp5(altura / Math.sin(rad));
  let capacidadMin = roundUp5(peso * 1.25);
  if (peso >= 60) capacidadMin = Math.max(capacidadMin, 80);
  return {
    angulo: info.angulo,
    longitudMin,
    capacidadMin,
    recomiendaEscalera: longitudMin > 200,
  };
}

export default function RampaCalculator({ productos }: Props) {
  const [altura, setAltura] = useState(65);
  const [peso, setPeso] = useState(25);
  const [perfil, setPerfil] = useState<Perfil>('senior');

  const result = useMemo(() => calcRampa(altura, peso, perfil), [altura, peso, perfil]);
  const perfilInfo = PERFILES.find((p) => p.id === perfil)!;
  const recomendados = productos.slice(0, 4);
  const notaRecomendados = notaPrecios(recomendados.map((p) => p.slug));

  return (
    <div className="border border-neutral-900 bg-white overflow-hidden">
      <div className="bg-navy-800 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de medida de rampa</h2>
      </div>

      <div className="p-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="altura" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Ruler size={16} className="text-primary-600" /> Altura del obstáculo
            </label>
            <div className="flex items-center gap-4">
              <input
                id="altura"
                type="range"
                min={20}
                max={100}
                step={1}
                value={altura}
                onChange={(e) => setAltura(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="altura-val"
              />
              <span id="altura-val" className="shrink-0 w-24 text-right">
                <NumberInput
                  min={20}
                  max={100}
                  value={altura}
                  onValueChange={setAltura}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Altura en centímetros"
                />
                <span className="ml-1 text-sm text-neutral-500">cm</span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS_ALTURA.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setAltura(p.cm)}
                  className={
                    'rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ' +
                    (altura === p.cm
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300')
                  }
                >
                  {p.label} {p.cm}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="peso-rampa" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Scale size={16} className="text-primary-600" /> Peso del perro
            </label>
            <div className="flex items-center gap-4">
              <input
                id="peso-rampa"
                type="range"
                min={2}
                max={80}
                step={1}
                value={peso}
                onChange={(e) => setPeso(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="peso-rampa-val"
              />
              <span id="peso-rampa-val" className="shrink-0 w-24 text-right">
                <NumberInput
                  min={2}
                  max={80}
                  value={peso}
                  onValueChange={setPeso}
                  className="w-14 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Peso en kilogramos"
                />
                <span className="ml-1 text-sm text-neutral-500">kg</span>
              </span>
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-neutral-800 mb-2">Perfil del perro</span>
            <div className="grid grid-cols-3 gap-2">
              {PERFILES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPerfil(p.id)}
                  aria-pressed={perfil === p.id}
                  className={
                    'rounded-lg border px-2 py-2 text-xs font-bold transition-colors ' +
                    (perfil === p.id
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                >
                  {p.label}
                  <span className="block mt-0.5 font-semibold text-[10px] opacity-70">{p.angulo}°</span>
                </button>
              ))}
            </div>
            <p className="mt-2 flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
              <span>{perfilInfo.nota}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Resultado orientativo · {result.angulo}°
          </p>

          {result.recomiendaEscalera ? (
            <>
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-xs leading-relaxed text-amber-950"
                role="status"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Mejor una escalera de peldaños.</strong> Con {altura} cm de altura y {result.angulo}°
                  de pendiente segura, la rampa mediría al menos{' '}
                  <strong>{result.longitudMin} cm</strong> — más de lo razonable en casa y por encima de las
                  rampas del catálogo (hasta ~180 cm). Una escalera estable de 4–5 peldaños suele ser más
                  práctica.
                </span>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Longitud mínima teórica de rampa</p>
                <p className="text-2xl font-black text-neutral-900">{result.longitudMin} cm</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm text-neutral-600 mb-1">Longitud mínima de rampa</p>
              <p className="text-3xl font-black text-neutral-900 tracking-tight">
                {result.longitudMin} <span className="text-xl text-primary-700">cm</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Ángulo seguro ≈ {result.angulo}°. Una rampa más corta implica más pendiente.
              </p>
            </div>
          )}

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-sm text-neutral-600 mb-1">Capacidad de carga necesaria</p>
            <p className="font-black text-neutral-900 text-xl">
              ≥ {result.capacidadMin} kg
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Tu perro pesa {peso} kg; incluimos un margen del 25 %.
            </p>
          </div>

          {!result.recomiendaEscalera && (
            <p className="text-[11px] leading-relaxed text-neutral-400">
              Preferible superficie antideslizante y laterales o bordes si es estrecha. Altura medida:{' '}
              {altura} cm.
            </p>
          )}
        </div>
      </div>

      {recomendados.length > 0 && (
        <div className="border-t border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">
            {result.recomiendaEscalera
              ? 'Escaleras y rampas que hemos analizado'
              : 'Rampas mejor valoradas que hemos analizado'}
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
            href="/categoria/rampas/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
          >
            Ver todas las rampas analizadas <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

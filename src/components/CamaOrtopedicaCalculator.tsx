import React, { useMemo, useState } from 'react';
import { Calculator, Ruler, Scale, ArrowRight, Star, Info } from 'lucide-react';
import type { CalcProducto } from './CondroprotectorCalculator';

interface Props {
  productos: CalcProducto[];
}

type Postura = 'estirado' | 'ovillado' | 'lado';

interface PosturaInfo {
  id: Postura;
  label: string;
  anchoFactor: number;
  anchoMin: number;
  nota: string;
}

// Largo fijo: longitud del perro + 30 cm. La postura solo cambia el ancho.
const POSTURAS: PosturaInfo[] = [
  {
    id: 'estirado',
    label: 'Estirado',
    anchoFactor: 0.55,
    anchoMin: 40,
    nota: 'Postura alargada: el ancho puede ser más contenido si el largo cubre hocico–cola + 30 cm.',
  },
  {
    id: 'lado',
    label: 'De lado',
    anchoFactor: 0.7,
    anchoMin: 45,
    nota: 'Necesita más ancho para codos y cadera sin colgar del borde.',
  },
  {
    id: 'ovillado',
    label: 'Ovillado',
    anchoFactor: 0.65,
    anchoMin: 40,
    nota: 'Aunque se enrolle, mantenemos el largo +30 cm por si se estira por la noche.',
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundUp5(n: number) {
  return Math.ceil(n / 5) * 5;
}

export function grosorPorPeso(peso: number): { min: number; ideal?: string } {
  if (peso <= 15) return { min: 8 };
  if (peso <= 30) return { min: 10 };
  return { min: 12, ideal: '15–19' };
}

export interface CamaResultado {
  largo: number;
  ancho: number;
  grosorMin: number;
  grosorIdeal?: string;
}

export function calcCama(longitud: number, peso: number, postura: Postura): CamaResultado {
  const info = POSTURAS.find((p) => p.id === postura)!;
  const largo = roundUp5(longitud + 30);
  const ancho = roundUp5(Math.max(info.anchoMin, longitud * info.anchoFactor));
  const grosor = grosorPorPeso(peso);
  return {
    largo,
    ancho,
    grosorMin: grosor.min,
    grosorIdeal: grosor.ideal,
  };
}

export default function CamaOrtopedicaCalculator({ productos }: Props) {
  const [longitud, setLongitud] = useState(70);
  const [peso, setPeso] = useState(25);
  const [postura, setPostura] = useState<Postura>('estirado');

  const result = useMemo(() => calcCama(longitud, peso, postura), [longitud, peso, postura]);
  const posturaInfo = POSTURAS.find((p) => p.id === postura)!;
  const recomendados = productos.slice(0, 4);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de talla de cama ortopédica</h2>
      </div>

      <div className="p-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="longitud-cama" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Ruler size={16} className="text-primary-600" /> Longitud del perro
            </label>
            <div className="flex items-center gap-4">
              <input
                id="longitud-cama"
                type="range"
                min={20}
                max={120}
                step={1}
                value={longitud}
                onChange={(e) => setLongitud(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="longitud-cama-val"
              />
              <span id="longitud-cama-val" className="shrink-0 w-24 text-right">
                <input
                  type="number"
                  min={20}
                  max={120}
                  value={longitud}
                  onChange={(e) => setLongitud(clamp(Number(e.target.value) || 20, 20, 120))}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Longitud en centímetros"
                />
                <span className="ml-1 text-sm text-neutral-500">cm</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Morro hasta la base de la cola (sin incluir la cola).
            </p>
          </div>

          <div>
            <label htmlFor="peso-cama" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Scale size={16} className="text-primary-600" /> Peso del perro
            </label>
            <div className="flex items-center gap-4">
              <input
                id="peso-cama"
                type="range"
                min={2}
                max={80}
                step={1}
                value={peso}
                onChange={(e) => setPeso(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="peso-cama-val"
              />
              <span id="peso-cama-val" className="shrink-0 w-24 text-right">
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
          </div>

          <div>
            <span className="block text-sm font-bold text-neutral-800 mb-2">Postura habitual al dormir</span>
            <div className="grid grid-cols-3 gap-2">
              {POSTURAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPostura(p.id)}
                  aria-pressed={postura === p.id}
                  className={
                    'rounded-lg border px-2 py-2 text-xs font-bold transition-colors ' +
                    (postura === p.id
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-2 flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
              <span>{posturaInfo.nota}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Resultado orientativo
          </p>

          <div>
            <p className="text-sm text-neutral-600 mb-1">Medidas mínimas de cama</p>
            <p className="text-3xl font-black text-neutral-900 tracking-tight">
              {result.largo} × {result.ancho}{' '}
              <span className="text-xl text-primary-700">cm</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Largo = {longitud} cm + 30 cm de margen. Ancho según postura «{posturaInfo.label.toLowerCase()}».
            </p>
          </div>

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-sm text-neutral-600 mb-1">Grosor de espuma recomendado</p>
            <p className="font-black text-neutral-900 text-xl">
              ≥ {result.grosorMin} cm
              {result.grosorIdeal && (
                <span className="ml-2 text-sm font-bold text-primary-700">
                  (ideal {result.grosorIdeal} cm)
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Viscoelástica / memory foam. Si la espuma queda hundida horas después, ha perdido soporte.
            </p>
          </div>

          <p className="text-[11px] leading-relaxed text-neutral-400">
            Mejor pasarse de tamaño que quedarse corto. Si dudas entre dos tallas comerciales, elige la
            mayor.
          </p>
        </div>
      </div>

      {recomendados.length > 0 && (
        <div className="border-t border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">
            Camas ortopédicas mejor valoradas que hemos analizado
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
          <a
            href="/categoria/camas-ortopedicas/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
          >
            Ver todas las camas ortopédicas analizadas <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

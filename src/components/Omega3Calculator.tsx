import React, { useMemo, useState } from 'react';
import { Calculator, Dog, ArrowRight, Star, Info } from 'lucide-react';
import { notaPrecios } from '../utils/precioConsultado';
import NumberInput from './NumberInput';

export interface Omega3Producto {
  slug: string;
  titulo: string;
  precio: string;
  valoracion: number;
  /** % d'EPA+DHA en pes que declara la fitxa (només olis). */
  epaDhaPct: number;
}

interface Props {
  productos: Omega3Producto[];
}

// Dosi de referència: mitjana de l'assaig amb placebo de Mehler et al. (2016) en gossos
// amb artrosi, 69 mg d'EPA+DHA per kg i dia.
const MG_KG_ARTROSIS = 69;
// Densitat aproximada d'un oli de peix (g/ml) i energia del greix (kcal/g).
const DENSIDAD = 0.92;
const KCAL_G = 9;
// Energia de manteniment orientativa d'un adult castrat: 1,6 × 70 × kg^0,75 (kcal/dia).
const kcalDia = (peso: number) => 1.6 * 70 * Math.pow(peso, 0.75);

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const fmt1 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
// Mitges unitats (ml) o unitats senceres (càpsules), mai per sota de la meitat d'una.
const redondeaMl = (n: number) => Math.max(0.5, Math.round(n * 2) / 2);

type Fuente = { tipo: 'catalogo'; slug: string } | { tipo: 'aceite' } | { tipo: 'capsula' };

export default function Omega3Calculator({ productos }: Props) {
  const [peso, setPeso] = useState<number>(20);
  const [fuente, setFuente] = useState<Fuente>(
    productos[0] ? { tipo: 'catalogo', slug: productos[0].slug } : { tipo: 'aceite' },
  );
  const [pctOtro, setPctOtro] = useState<string>('');
  const [mgCapsula, setMgCapsula] = useState<string>('');

  const mgDia = peso * MG_KG_ARTROSIS;

  const resultado = useMemo(() => {
    const num = (s: string) => Number(s.replace(',', '.'));
    let pct = 0;
    if (fuente.tipo === 'catalogo') pct = productos.find((p) => p.slug === fuente.slug)?.epaDhaPct ?? 0;
    if (fuente.tipo === 'aceite') pct = num(pctOtro);
    if (fuente.tipo === 'capsula') {
      const mg = num(mgCapsula);
      if (!(mg > 0)) return null;
      return { tipo: 'capsula' as const, capsulas: Math.max(1, Math.round(mgDia / mg)) };
    }
    if (!(pct > 0 && pct <= 100)) return null;
    const mgPorMl = (pct / 100) * DENSIDAD * 1000;
    const ml = mgDia / mgPorMl;
    const kcal = ml * DENSIDAD * KCAL_G;
    return {
      tipo: 'aceite' as const,
      mgPorMl,
      ml: redondeaMl(ml),
      kcal,
      pctEnergia: (kcal / kcalDia(peso)) * 100,
    };
  }, [fuente, pctOtro, mgCapsula, mgDia, peso, productos]);

  const recomendados = productos.slice(0, 4);
  const notaRecomendados = notaPrecios(recomendados.map((p) => p.slug));

  const boton = (activo: boolean) =>
    'rounded-lg border px-3 py-2 text-xs font-bold text-left transition-colors ' +
    (activo
      ? 'border-primary-600 bg-primary-50 text-primary-700'
      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300');

  return (
    <div className="border border-neutral-900 bg-white overflow-hidden">
      <div className="bg-navy-800 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de dosis de omega-3</h2>
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
                <NumberInput
                  min={1}
                  max={90}
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
            <span className="block text-sm font-bold text-neutral-800 mb-2">Tu producto</span>
            <div className="grid gap-2" role="group" aria-label="Producto de omega-3">
              {productos.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setFuente({ tipo: 'catalogo', slug: p.slug })}
                  aria-pressed={fuente.tipo === 'catalogo' && fuente.slug === p.slug}
                  className={boton(fuente.tipo === 'catalogo' && fuente.slug === p.slug)}
                >
                  {p.titulo} <span className="font-normal text-neutral-500">· {fmt1(p.epaDhaPct)} % EPA+DHA</span>
                </button>
              ))}
              <button type="button" onClick={() => setFuente({ tipo: 'aceite' })} aria-pressed={fuente.tipo === 'aceite'} className={boton(fuente.tipo === 'aceite')}>
                Otro aceite: sé el % de EPA+DHA
              </button>
              <button type="button" onClick={() => setFuente({ tipo: 'capsula' })} aria-pressed={fuente.tipo === 'capsula'} className={boton(fuente.tipo === 'capsula')}>
                Cápsulas: sé los mg de EPA+DHA por cápsula
              </button>
            </div>

            {fuente.tipo === 'aceite' && (
              <div className="mt-3">
                <label htmlFor="pct" className="block text-xs text-neutral-600 mb-1">
                  % de EPA + % de DHA (súmalos; lo pone la etiqueta)
                </label>
                <input
                  id="pct"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={100}
                  placeholder="p. ej. 6"
                  value={pctOtro}
                  onChange={(e) => setPctOtro(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-900"
                />
              </div>
            )}
            {fuente.tipo === 'capsula' && (
              <div className="mt-3">
                <label htmlFor="mgcap" className="block text-xs text-neutral-600 mb-1">
                  mg de EPA + mg de DHA en una cápsula (no los mg de aceite)
                </label>
                <input
                  id="mgcap"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  placeholder="p. ej. 300"
                  value={mgCapsula}
                  onChange={(e) => setMgCapsula(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-900"
                />
              </div>
            )}
          </div>

          <p className="flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
            <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
            <span>
              Esta dosis es la del ensayo de artrosis. Para la piel y el pelo no hay una dosis de estudio
              clara: la de la etiqueta suele bastar.
            </span>
          </p>
        </div>

        {/* Resultado */}
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-3">
            Referencia para artrosis · {peso} kg
          </p>
          <p className="flex items-baseline justify-between border-b border-neutral-200 pb-3">
            <span className="text-sm text-neutral-600">EPA+DHA al día</span>
            <span className="font-black text-2xl text-neutral-900">{fmt(mgDia)} mg</span>
          </p>

          {resultado?.tipo === 'aceite' && (
            <div className="mt-4 space-y-3">
              <p className="flex items-baseline justify-between">
                <span className="text-sm text-neutral-600">Con tu aceite</span>
                <span className="font-black text-2xl text-neutral-900">{fmt1(resultado.ml)} ml/día</span>
              </p>
              <p className="text-xs text-neutral-500">
                Unos {fmt(resultado.mgPorMl)} mg de EPA+DHA por ml · unas {fmt(resultado.kcal)} kcal al día
                ({fmt(resultado.pctEnergia)} % de lo que suele comer un perro adulto de {peso} kg).
              </p>
              {resultado.pctEnergia > 10 && (
                <p className="text-xs text-amber-700">
                  Son muchas calorías de grasa. Para llegar a esta dosis tiene más sentido un aceite
                  concentrado, o ajustar la ración con el veterinario.
                </p>
              )}
            </div>
          )}
          {resultado?.tipo === 'capsula' && (
            <p className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-neutral-600">Con tus cápsulas</span>
              <span className="font-black text-2xl text-neutral-900">
                {resultado.capsulas} {resultado.capsulas === 1 ? 'cápsula' : 'cápsulas'}/día
              </span>
            </p>
          )}
          {!resultado && (
            <p className="mt-4 text-xs text-neutral-400">
              Introduce el dato de tu producto y te decimos cuánto darle.
            </p>
          )}

          <ul className="mt-5 border-t border-neutral-200 pt-4 space-y-1.5 text-xs leading-relaxed text-neutral-600 list-disc pl-4">
            <li>Empieza con una cuarta parte y sube en una o dos semanas, para evitar heces blandas.</li>
            <li>A esta dosis, coméntalo con el veterinario, sobre todo si toma antiinflamatorios o va a operarse.</li>
            <li>La mejora en los ensayos se confirmó a las 12 semanas.</li>
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
            Orientativo, no sustituye el consejo veterinario. Si tu veterinario da otra pauta, esa manda.
          </p>
        </div>
      </div>

      {recomendados.length > 0 && (
        <div className="border-t border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">
            Aceites que declaran su EPA+DHA
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
                    <span>· {fmt1(p.epaDhaPct)} % EPA+DHA</span>
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-primary-500 transition-transform group-hover:translate-x-1" />
              </a>
            ))}
          </div>
          {notaRecomendados && <p className="mt-3 text-[11px] text-neutral-400">{notaRecomendados}</p>}
          <a
            href="/categoria/omega-3-y-aceite-de-salmon/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
          >
            Ver todos los omega-3 analizados <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

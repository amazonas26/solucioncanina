import React, { useMemo, useState } from 'react';
import { Calculator, Ruler, ArrowRight, Star, AlertTriangle, Info } from 'lucide-react';
import type { CalcProducto } from './CondroprotectorCalculator';
import { notaPrecios } from '../utils/precioConsultado';
import NumberInput from './NumberInput';

interface Props {
  productos: CalcProducto[];
}

type TipoHocico = 'normal' | 'braquicefalo';
type TipoBozal = 'cesta' | 'silicona';

interface TallaRow {
  num: number;
  label: string;
  periMin: number;
  periMax: number;
  longRef: number;
}

// Tabla orientativa alineada con tallas numéricas tipo Baskerville Ultra / canasta.
// Criterio principal: perímetro. La longitud valida profundidad; nunca se baja de talla.
const TALLAS: TallaRow[] = [
  { num: 1, label: 'XS', periMin: 10, periMax: 16, longRef: 4 },
  { num: 2, label: 'S', periMin: 16, periMax: 21, longRef: 5 },
  { num: 3, label: 'M', periMin: 21, periMax: 26, longRef: 6.5 },
  { num: 4, label: 'L', periMin: 26, periMax: 31, longRef: 7.5 },
  { num: 5, label: 'XL', periMin: 31, periMax: 37, longRef: 9 },
  { num: 6, label: 'XXL', periMin: 37, periMax: 50, longRef: 11 },
];

function tallaPorPerimetro(perimetro: number): TallaRow {
  // En el límite exacto entre filas, sube de talla.
  for (let i = 0; i < TALLAS.length; i++) {
    const row = TALLAS[i];
    const next = TALLAS[i + 1];
    if (perimetro >= row.periMin && perimetro < row.periMax) return row;
    if (next && perimetro === row.periMax) return next;
    if (!next && perimetro >= row.periMin && perimetro <= row.periMax) return row;
  }
  return perimetro < TALLAS[0].periMin ? TALLAS[0] : TALLAS[TALLAS.length - 1];
}

function tipoBozal(tipoHocico: TipoHocico, perimetro: number): TipoBozal {
  if (tipoHocico === 'braquicefalo') return 'cesta';
  if (perimetro > 31) return 'cesta';
  return 'silicona';
}

export interface BozalResultado {
  talla: TallaRow;
  tipo: TipoBozal;
  avisoMedida: string | null;
  subioPorLongitud: boolean;
}

export function calcBozal(perimetro: number, longitud: number, tipoHocico: TipoHocico): BozalResultado {
  let talla = tallaPorPerimetro(perimetro);
  let avisoMedida: string | null = null;
  let subioPorLongitud = false;

  const longMinEsperada = talla.longRef * 0.8;
  const longMaxEsperada = talla.longRef * 1.2;

  if (longitud > longMaxEsperada && talla.num < 6) {
    talla = TALLAS.find((t) => t.num === talla.num + 1)!;
    subioPorLongitud = true;
  } else if (longitud < longMinEsperada) {
    if (tipoHocico === 'braquicefalo') {
      avisoMedida =
        'Hocico más corto que la referencia de esta talla: es esperable en braquicéfalos. Mantén la talla del perímetro y elige cesta con volumen frontal.';
    } else {
      avisoMedida =
        'La longitud no encaja con la referencia de esta talla. Vuelve a medir (nariz → 1-2 cm bajo el ojo) y el perímetro en el punto más ancho. No elijas una talla más pequeña: un bozal justo impide jadear.';
    }
  }

  return {
    talla,
    tipo: tipoBozal(tipoHocico, perimetro),
    avisoMedida,
    subioPorLongitud,
  };
}

const TIPOS_HOCICO: { id: TipoHocico; label: string }[] = [
  { id: 'normal', label: 'Normal / alargado' },
  { id: 'braquicefalo', label: 'Braquicéfalo' },
];

export default function BozalCalculator({ productos }: Props) {
  const [perimetro, setPerimetro] = useState(24);
  const [longitud, setLongitud] = useState(7);
  const [tipoHocico, setTipoHocico] = useState<TipoHocico>('normal');

  const result = useMemo(
    () => calcBozal(perimetro, longitud, tipoHocico),
    [perimetro, longitud, tipoHocico]
  );

  const recomendados = productos.slice(0, 4);
  const notaRecomendados = notaPrecios(recomendados.map((p) => p.slug));
  const tipoLabel =
    result.tipo === 'cesta' ? 'Cesta (rígida o silicona abierta tipo canasta)' : 'Silicona abierta';

  return (
    <div className="border border-neutral-900 bg-white overflow-hidden">
      <div className="bg-navy-800 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de talla de bozal</h2>
      </div>

      <div className="p-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="perimetro" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Ruler size={16} className="text-primary-600" /> Perímetro del hocico
            </label>
            <div className="flex items-center gap-4">
              <input
                id="perimetro"
                type="range"
                min={10}
                max={50}
                step={0.5}
                value={perimetro}
                onChange={(e) => setPerimetro(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="perimetro-val"
              />
              <span id="perimetro-val" className="shrink-0 w-24 text-right">
                <NumberInput
                  min={10}
                  max={50}
                  value={perimetro}
                  onValueChange={setPerimetro}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Perímetro en centímetros"
                />
                <span className="ml-1 text-sm text-neutral-500">cm</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">En el punto más ancho, justo debajo de los ojos.</p>
          </div>

          <div>
            <label htmlFor="longitud" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Ruler size={16} className="text-primary-600" /> Longitud del hocico
            </label>
            <div className="flex items-center gap-4">
              <input
                id="longitud"
                type="range"
                min={2}
                max={15}
                step={0.5}
                value={longitud}
                onChange={(e) => setLongitud(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="longitud-val"
              />
              <span id="longitud-val" className="shrink-0 w-24 text-right">
                <NumberInput
                  min={2}
                  max={15}
                  value={longitud}
                  onValueChange={setLongitud}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Longitud en centímetros"
                />
                <span className="ml-1 text-sm text-neutral-500">cm</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Punta de la nariz hasta 1–2 cm por debajo del ojo interior.
            </p>
          </div>

          <div>
            <span className="block text-sm font-bold text-neutral-800 mb-2">Tipo de hocico</span>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_HOCICO.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipoHocico(t.id)}
                  aria-pressed={tipoHocico === t.id}
                  className={
                    'rounded-lg border px-2 py-2 text-xs font-bold transition-colors ' +
                    (tipoHocico === t.id
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
              <span>
                Braquicéfalo: bulldog, carlino, bóxer, boston terrier y similares. Necesitan más volumen
                frontal para jadear.
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Resultado orientativo
          </p>
          <div>
            <p className="text-sm text-neutral-600 mb-1">Talla recomendada</p>
            <p className="text-3xl font-black text-neutral-900 tracking-tight">
              {result.talla.num}{' '}
              <span className="text-xl text-primary-700">({result.talla.label})</span>
            </p>
            {result.subioPorLongitud && (
              <p className="mt-1 text-xs text-neutral-500">
                Subimos una talla porque la longitud del hocico pide más profundidad de cesta.
              </p>
            )}
          </div>
          <div className="border-t border-neutral-200 pt-3">
            <p className="text-sm text-neutral-600 mb-1">Tipo recomendado</p>
            <p className="font-black text-neutral-900">{tipoLabel}</p>
          </div>

          <div
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-xs leading-relaxed text-amber-950"
            role="status"
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <span>
              <strong>Aviso importante:</strong> el bozal debe permitir <strong>jadear, beber y aceptar
              premios</strong>. Si la lengua no sale con facilidad, el hocico queda comprimido o babea en
              exceso, la talla es pequeña o el modelo no es adecuado. Nunca uses bozal de tela cerrada en
              paseos ni visitas largas.
            </span>
          </div>

          {result.avisoMedida && (
            <p className="flex gap-2 text-xs leading-relaxed text-neutral-600 bg-white border border-neutral-200 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
              <span>{result.avisoMedida}</span>
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-neutral-400">
            Con el bozal puesto debes poder meter un dedo entre la correa del cuello y el perro. Confirma
            siempre con la tabla del fabricante: cada marca numera distinto.
          </p>
        </div>
      </div>

      {recomendados.length > 0 && (
        <div className="border-t border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">
            Bozales mejor valorados que hemos analizado
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
            href="/categoria/bozales/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
          >
            Ver todos los bozales analizados <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Calculator, Ruler, ArrowRight, Star, AlertTriangle, Info } from 'lucide-react';
import { notaPrecios } from '../utils/precioConsultado';
import NumberInput from './NumberInput';

export interface TallaPanal {
  talla: string;
  min: number;
  max: number;
  pesoMin?: number;
  pesoMax?: number;
  deducida?: boolean;
}

export interface PanalProducto {
  slug: string;
  titulo: string;
  precio: string;
  valoracion: number;
  sexo: 'macho' | 'hembra';
  tipo: 'desechable' | 'lavable';
  tallas: TallaPanal[];
}

interface Props {
  productos: PanalProducto[];
}

type Sexo = 'macho' | 'hembra';
type Tipo = 'todos' | 'desechable' | 'lavable';

export interface ResultadoPanal {
  producto: PanalProducto;
  tallas: TallaPanal[];
  fuera: 'pequeno' | 'grande' | null;
}

// Totes les talles de la marca on cap la cintura (n'hi pot haver dues: les taules se solapen).
export function tallasParaCintura(cintura: number, producto: PanalProducto): ResultadoPanal {
  const tallas = producto.tallas.filter((t) => cintura >= t.min && cintura <= t.max);
  let fuera: ResultadoPanal['fuera'] = null;
  if (tallas.length === 0) {
    const min = Math.min(...producto.tallas.map((t) => t.min));
    const max = Math.max(...producto.tallas.map((t) => t.max));
    if (cintura < min) fuera = 'pequeno';
    else if (cintura > max) fuera = 'grande';
  }
  return { producto, tallas, fuera };
}

const kg = (n: number) => String(n).replace('.', ',');

export function pesoTalla(t: TallaPanal): string {
  if (t.pesoMin && t.pesoMax) return `${kg(t.pesoMin)}–${kg(t.pesoMax)} kg`;
  if (t.pesoMax) return `hasta ${kg(t.pesoMax)} kg`;
  if (t.pesoMin) return `más de ${kg(t.pesoMin)} kg`;
  return '';
}

function rangoTalla(t: TallaPanal): string {
  const peso = pesoTalla(t);
  return `${t.min}–${t.max} cm${peso ? ` · ${peso}` : ''}`;
}

function TarjetaResultado({ r }: { r: ResultadoPanal }) {
  const { producto, tallas, fuera } = r;
  const encaja = tallas.length > 0;
  return (
    <a
      href={`/producto/${producto.slug}/`}
      className={`group flex flex-col gap-2 rounded-xl border bg-white p-4 transition-all hover:shadow-sm ${
        encaja ? 'border-neutral-200 hover:border-primary-300' : 'border-neutral-200 opacity-70 hover:opacity-100'
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold text-neutral-800 group-hover:text-primary-600 transition-colors">
          {producto.titulo}
        </span>
        <ArrowRight size={16} className="shrink-0 mt-0.5 text-primary-500 transition-transform group-hover:translate-x-1" />
      </span>
      <span className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-600">
          {producto.tipo === 'lavable' ? 'Lavable' : 'Desechable'}
        </span>
        {producto.valoracion > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Star size={12} className="fill-amber-400 text-amber-400" /> {producto.valoracion}
          </span>
        )}
        {producto.precio && <span>· {producto.precio}</span>}
      </span>
      {encaja ? (
        <span className="block">
          <span className="block text-2xl font-black tracking-tight text-neutral-900">
            Talla {tallas.map((t) => t.talla).join(' o ')}
          </span>
          {tallas.map((t) => (
            <span key={t.talla} className="block text-xs text-neutral-500">
              {t.talla}: {rangoTalla(t)}
              {t.deducida && ' (deducida: confírmala en la tabla de la marca)'}
            </span>
          ))}
        </span>
      ) : (
        <span className="block text-sm text-neutral-600">
          {fuera === 'pequeno'
            ? `Tu perro es más pequeño que su talla menor (desde ${Math.min(...producto.tallas.map((t) => t.min))} cm).`
            : fuera === 'grande'
              ? `Tu perro es más grande que su talla mayor (hasta ${Math.max(...producto.tallas.map((t) => t.max))} cm).`
              : 'Tu medida cae entre dos tallas de esta marca: mira su tabla.'}
        </span>
      )}
    </a>
  );
}

export default function PanalCalculator({ productos }: Props) {
  const [sexo, setSexo] = useState<Sexo>('macho');
  const [cintura, setCintura] = useState(45);
  const [tipo, setTipo] = useState<Tipo>('todos');

  const ordenar = (lista: ResultadoPanal[]) =>
    [...lista].sort((a, b) => Number(b.tallas.length > 0) - Number(a.tallas.length > 0) || b.producto.valoracion - a.producto.valoracion);

  const resultados = useMemo(
    () =>
      ordenar(
        productos
          .filter((p) => p.sexo === sexo && (tipo === 'todos' || p.tipo === tipo))
          .map((p) => tallasParaCintura(cintura, p)),
      ),
    [productos, sexo, tipo, cintura],
  );

  // Un mascle amb escapes de femta necessita un bolquer complet: els de femella.
  const completos = useMemo(
    () =>
      sexo === 'macho'
        ? ordenar(
            productos
              .filter((p) => p.sexo === 'hembra' && (tipo === 'todos' || p.tipo === tipo))
              .map((p) => tallasParaCintura(cintura, p)),
          )
        : [],
    [productos, sexo, tipo, cintura],
  );

  const algunaDoble = [...resultados, ...completos].some((r) => r.tallas.length > 1);
  const ninguna = resultados.length > 0 && resultados.every((r) => r.tallas.length === 0);
  const nota = notaPrecios([...resultados, ...completos].map((r) => r.producto.slug));

  const boton = (activo: boolean) =>
    `flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
      activo
        ? 'border-primary-600 bg-primary-600 text-white'
        : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
    }`;

  return (
    <div className="border border-neutral-900 bg-white overflow-hidden">
      <div className="bg-navy-800 px-6 py-4 flex items-center gap-3 text-white">
        <Calculator size={22} />
        <h2 className="text-lg font-black tracking-tight">Calculadora de talla de pañal</h2>
      </div>

      <div className="p-6 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-bold text-neutral-800 mb-2">Tu perro es</legend>
            <div className="flex gap-2">
              <button type="button" className={boton(sexo === 'macho')} aria-pressed={sexo === 'macho'} onClick={() => setSexo('macho')}>
                Macho
              </button>
              <button type="button" className={boton(sexo === 'hembra')} aria-pressed={sexo === 'hembra'} onClick={() => setSexo('hembra')}>
                Hembra
              </button>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              {sexo === 'macho'
                ? 'Para machos, faja: rodea la barriga y tapa el pene. Recoge el pis, no las heces.'
                : 'Para hembras, pañal completo con agujero para la cola. Recoge pis y heces.'}
            </p>
          </fieldset>

          <div>
            <label htmlFor="cintura-panal" className="flex items-center gap-2 text-sm font-bold text-neutral-800 mb-2">
              <Ruler size={16} className="text-primary-600" /> Perímetro de la cintura
            </label>
            <div className="flex items-center gap-4">
              <input
                id="cintura-panal"
                type="range"
                min={15}
                max={95}
                step={1}
                value={cintura}
                onChange={(e) => setCintura(Number(e.target.value))}
                className="flex-grow accent-primary-600"
                aria-describedby="cintura-panal-val"
              />
              <span id="cintura-panal-val" className="shrink-0 w-24 text-right">
                <NumberInput
                  min={15}
                  max={95}
                  value={cintura}
                  onValueChange={setCintura}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-right font-bold text-neutral-900"
                  aria-label="Perímetro de la cintura en centímetros"
                />
                <span className="ml-1 text-sm text-neutral-500">cm</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Justo delante de las patas traseras, con el perro de pie y el metro sin apretar.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-neutral-800 mb-2">Tipo</legend>
            <div className="flex gap-2">
              {(['todos', 'desechable', 'lavable'] as Tipo[]).map((t) => (
                <button key={t} type="button" className={boton(tipo === t)} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
                  {t === 'todos' ? 'Todos' : t === 'desechable' ? 'Desechable' : 'Lavable'}
                </button>
              ))}
            </div>
            <p className="mt-2 flex gap-2 text-xs leading-relaxed text-neutral-500 bg-neutral-50 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-neutral-400" />
              <span>
                Los desechables absorben más y van mejor de noche; los lavables salen más baratos a la larga
                y bastan para goteos.
              </span>
            </p>
          </fieldset>
        </div>

        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Talla de cada {sexo === 'macho' ? 'faja' : 'pañal'} para {cintura} cm de cintura
          </p>

          {resultados.length === 0 ? (
            <p className="text-sm text-neutral-600">No hay productos de este tipo en el catálogo.</p>
          ) : (
            <div className="grid gap-3">
              {resultados.map((r) => (
                <TarjetaResultado key={r.producto.slug} r={r} />
              ))}
            </div>
          )}

          {ninguna && (
            <p className="flex gap-2 text-xs leading-relaxed text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                Ninguno encaja con esa medida. Vuelve a medir delante de las patas traseras; si la medida es
                correcta, prueba con el otro tipo o busca una marca con tallas más amplias.
              </span>
            </p>
          )}

          {algunaDoble && (
            <p className="text-xs leading-relaxed text-neutral-600">
              Si te salen dos tallas, tu medida cae donde se solapan. Si la marca da el peso, desempata con él;
              si no, pide la grande, que se puede ajustar con el velcro.
            </p>
          )}

          {completos.length > 0 && (
            <div className="border-t border-neutral-200 pt-3">
              <p className="text-sm font-bold text-neutral-800 mb-2">¿También se le escapan las heces?</p>
              <p className="text-xs text-neutral-500 mb-3">
                La faja no las recoge: hace falta un pañal completo. En un macho, comprueba que la parte de delante llegue a tapar el pene.
              </p>
              <div className="grid gap-3">
                {completos.map((r) => (
                  <TarjetaResultado key={r.producto.slug} r={r} />
                ))}
              </div>
            </div>
          )}

          {nota && <p className="text-[11px] text-neutral-400">{nota}</p>}
        </div>
      </div>

      <div className="border-t border-neutral-200 px-6 py-4">
        <a
          href="/categoria/incontinencia/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
        >
          Ver pañales, empapadores y limpiadores analizados <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}

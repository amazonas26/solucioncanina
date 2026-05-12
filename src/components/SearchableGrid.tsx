import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Star,
  Tag,
  ArrowUpDown,
} from 'lucide-react';
import { ProductCard } from './ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function parsePrice(p?: string): number | null {
  if (!p) return null;
  const m = p.match(/(\d+[.,]?\d*)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

interface Articulo {
  data: {
    nombre: string;
    linkAmazon: string;
    imagen?: string;
    descripcion?: string;
    precio?: string;
    precioOriginal?: string;
    descuentoPct?: number;
    categoria?: string;
    marca?: string;
    valoracion?: number;
    valoracionesCount?: number;
  };
  id: string;
}

interface SearchableGridProps {
  articulos: Articulo[];
}

type SortOption = 'none' | 'price-asc' | 'price-desc' | 'rating-desc' | 'discount-desc';

interface FilterState {
  sort: SortOption;
  priceMin: string;
  priceMax: string;
  minRating: number;
  onlyDiscounts: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  sort: 'none',
  priceMin: '',
  priceMax: '',
  minRating: 0,
  onlyDiscounts: false,
};

const SORT_LABELS: Record<SortOption, string> = {
  'none': 'Sin ordenar',
  'price-asc': 'Precio: menor a mayor',
  'price-desc': 'Precio: mayor a menor',
  'rating-desc': 'Mejor valorados',
  'discount-desc': 'Mayor descuento',
};

export default function SearchableGrid({ articulos }: SearchableGridProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get('search');
    if (urlSearch) setSearch(urlSearch);

    const initialSearch = window.__sc?.search;
    if (typeof initialSearch === 'string' && !urlSearch) setSearch(initialSearch);

    if (typeof window.__sc?.category !== 'undefined') {
      setSelectedCategory(window.__sc.category ?? null);
    }

    const onSearch = (e: Event) => {
      const ce = e as CustomEvent<{ query?: string }>;
      const q = ce.detail?.query ?? '';
      setSearch(q);
    };
    const onCategory = (e: Event) => {
      const ce = e as CustomEvent<{ category?: string | null }>;
      setSelectedCategory(ce.detail?.category ?? null);
    };
    window.addEventListener('sc:search', onSearch);
    window.addEventListener('sc:category', onCategory);
    return () => {
      window.removeEventListener('sc:search', onSearch);
      window.removeEventListener('sc:category', onCategory);
    };
  }, []);

  // Tancar popover al fer click fora o pressionar Escape
  useEffect(() => {
    if (!isFiltersOpen) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsFiltersOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFiltersOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isFiltersOpen]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    articulos.forEach((art) => {
      if (art.data.categoria) cats.add(art.data.categoria);
    });
    return Array.from(cats).sort();
  }, [articulos]);

  // Núm de filtres aplicats (no compta categoria ni cerca)
  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (appliedFilters.sort !== 'none') n++;
    if (appliedFilters.priceMin !== '') n++;
    if (appliedFilters.priceMax !== '') n++;
    if (appliedFilters.minRating > 0) n++;
    if (appliedFilters.onlyDiscounts) n++;
    return n;
  }, [appliedFilters]);

  const filteredArticulos = useMemo(() => {
    const min = appliedFilters.priceMin !== '' ? parseFloat(appliedFilters.priceMin) : null;
    const max = appliedFilters.priceMax !== '' ? parseFloat(appliedFilters.priceMax) : null;

    const list = articulos.filter((art) => {
      const matchesSearch =
        art.data.nombre.toLowerCase().includes(search.toLowerCase()) ||
        art.data.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
        art.data.marca?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = selectedCategory
        ? art.data.categoria === selectedCategory
        : true;

      const price = parsePrice(art.data.precio);
      const matchesMin = min === null || (price !== null && price >= min);
      const matchesMax = max === null || (price !== null && price <= max);

      const rating = art.data.valoracion ?? 0;
      const matchesRating = appliedFilters.minRating === 0 || rating >= appliedFilters.minRating;

      const matchesDiscount = !appliedFilters.onlyDiscounts
        || (typeof art.data.descuentoPct === 'number' && art.data.descuentoPct > 0);

      return matchesSearch && matchesCategory && matchesMin && matchesMax && matchesRating && matchesDiscount;
    });

    // Ordenació
    const sort = appliedFilters.sort;
    if (sort !== 'none') {
      list.sort((a, b) => {
        if (sort === 'price-asc' || sort === 'price-desc') {
          const pa = parsePrice(a.data.precio);
          const pb = parsePrice(b.data.precio);
          // productes sense preu sempre al final
          if (pa === null && pb === null) return 0;
          if (pa === null) return 1;
          if (pb === null) return -1;
          return sort === 'price-asc' ? pa - pb : pb - pa;
        }
        if (sort === 'rating-desc') {
          return (b.data.valoracion ?? 0) - (a.data.valoracion ?? 0);
        }
        if (sort === 'discount-desc') {
          return (b.data.descuentoPct ?? 0) - (a.data.descuentoPct ?? 0);
        }
        return 0;
      });
    }

    return list;
  }, [articulos, search, selectedCategory, appliedFilters]);

  const handleOpenFilters = () => {
    setDraftFilters(appliedFilters);
    setIsFiltersOpen((o) => !o);
  };

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setIsFiltersOpen(false);
  };

  const handleClear = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Barra de cerca */}
          <div className="relative w-full lg:max-w-md group">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-primary-500 transition-colors">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, marca o categoría…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-neutral-900 placeholder:text-neutral-400 text-sm font-medium"
              id="catalog-search"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Botó desplegable de filtres */}
          <div className="relative">
            <button
              ref={triggerRef}
              onClick={handleOpenFilters}
              aria-haspopup="dialog"
              aria-expanded={isFiltersOpen}
              className={cn(
                "inline-flex items-center justify-between gap-2 px-4 py-3 rounded-lg border text-sm font-bold transition-all whitespace-nowrap w-full lg:w-auto",
                activeFiltersCount > 0
                  ? "bg-primary-600 text-white border-primary-600 shadow-sm hover:bg-primary-700"
                  : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
              )}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal size={16} />
                Filtros y orden
                {activeFiltersCount > 0 && (
                  <span className={cn(
                    "ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-extrabold",
                    "bg-white text-primary-700"
                  )}>
                    {activeFiltersCount}
                  </span>
                )}
              </span>
              <ChevronDown
                size={16}
                className={cn("transition-transform duration-200", isFiltersOpen && "rotate-180")}
              />
            </button>

            <AnimatePresence>
              {isFiltersOpen && (
                <motion.div
                  ref={popoverRef}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  role="dialog"
                  aria-label="Panel de filtros"
                  className="absolute right-0 left-0 lg:left-auto lg:right-0 mt-2 w-full lg:w-[380px] bg-white rounded-xl border border-neutral-200 shadow-2xl z-40 overflow-hidden"
                >
                  <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Ordenar */}
                    <fieldset>
                      <legend className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2.5">
                        <ArrowUpDown size={13} />
                        Ordenar por
                      </legend>
                      <div className="grid grid-cols-1 gap-1.5">
                        {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                          <label
                            key={opt}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors",
                              draftFilters.sort === opt
                                ? "bg-primary-50 text-primary-700 font-bold"
                                : "text-neutral-700 hover:bg-neutral-50"
                            )}
                          >
                            <input
                              type="radio"
                              name="sort"
                              value={opt}
                              checked={draftFilters.sort === opt}
                              onChange={() => setDraftFilters((f) => ({ ...f, sort: opt }))}
                              className="w-4 h-4 accent-primary-600"
                            />
                            {SORT_LABELS[opt]}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* Rang de preu */}
                    <fieldset>
                      <legend className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2.5">
                        <Tag size={13} />
                        Rango de precio
                      </legend>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            placeholder="Mínimo"
                            value={draftFilters.priceMin}
                            onChange={(e) =>
                              setDraftFilters((f) => ({ ...f, priceMin: e.target.value }))
                            }
                            className="w-full pl-3 pr-7 py-2 bg-white rounded-md border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm text-neutral-900 placeholder:text-neutral-400"
                          />
                          <span className="absolute inset-y-0 right-2.5 flex items-center text-xs text-neutral-400">
                            €
                          </span>
                        </div>
                        <span className="text-neutral-400 text-xs font-semibold">a</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            placeholder="Máximo"
                            value={draftFilters.priceMax}
                            onChange={(e) =>
                              setDraftFilters((f) => ({ ...f, priceMax: e.target.value }))
                            }
                            className="w-full pl-3 pr-7 py-2 bg-white rounded-md border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm text-neutral-900 placeholder:text-neutral-400"
                          />
                          <span className="absolute inset-y-0 right-2.5 flex items-center text-xs text-neutral-400">
                            €
                          </span>
                        </div>
                      </div>
                    </fieldset>

                    {/* Valoració mínima */}
                    <fieldset>
                      <legend className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2.5">
                        <Star size={13} />
                        Valoración mínima
                      </legend>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { v: 0, label: 'Todos' },
                          { v: 3, label: '3+' },
                          { v: 3.5, label: '3.5+' },
                          { v: 4, label: '4+' },
                          { v: 4.5, label: '4.5+' },
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() =>
                              setDraftFilters((f) => ({ ...f, minRating: opt.v }))
                            }
                            className={cn(
                              "flex items-center justify-center gap-0.5 px-2 py-2 rounded-md text-xs font-bold border transition-colors",
                              draftFilters.minRating === opt.v
                                ? "bg-primary-600 text-white border-primary-600"
                                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                            )}
                          >
                            {opt.v > 0 && (
                              <Star
                                size={11}
                                fill="currentColor"
                                className={
                                  draftFilters.minRating === opt.v
                                    ? 'text-yellow-300'
                                    : 'text-yellow-400'
                                }
                              />
                            )}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    {/* Només descomptes */}
                    <fieldset>
                      <label className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 rounded-md border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={draftFilters.onlyDiscounts}
                          onChange={(e) =>
                            setDraftFilters((f) => ({ ...f, onlyDiscounts: e.target.checked }))
                          }
                          className="w-4 h-4 accent-primary-600 rounded"
                        />
                        <span className="flex-1 text-sm font-semibold text-neutral-900">
                          Solo productos con descuento
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded">
                          oferta
                        </span>
                      </label>
                    </fieldset>
                  </div>

                  {/* Botons */}
                  <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-neutral-100 bg-neutral-50">
                    <button
                      type="button"
                      onClick={() => setDraftFilters(DEFAULT_FILTERS)}
                      className="px-3 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                    >
                      <Search size={15} />
                      Aplicar filtros
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Chips de categoria */}
        <div className="flex flex-wrap gap-2" id="category-filters">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              !selectedCategory
                ? "bg-navy-700 text-white shadow-sm"
                : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            )}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                cat === selectedCategory
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Resum de filtres actius */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-500 font-semibold">Filtros activos:</span>
            {appliedFilters.sort !== 'none' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md font-semibold">
                {SORT_LABELS[appliedFilters.sort]}
              </span>
            )}
            {appliedFilters.priceMin !== '' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md font-semibold">
                Desde {appliedFilters.priceMin}€
              </span>
            )}
            {appliedFilters.priceMax !== '' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md font-semibold">
                Hasta {appliedFilters.priceMax}€
              </span>
            )}
            {appliedFilters.minRating > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md font-semibold">
                <Star size={11} fill="currentColor" className="text-yellow-500" />
                {appliedFilters.minRating}+ estrellas
              </span>
            )}
            {appliedFilters.onlyDiscounts && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-md font-semibold">
                Solo descuentos
              </span>
            )}
            <button
              onClick={handleClear}
              className="ml-1 text-neutral-500 hover:text-neutral-900 underline underline-offset-2 font-semibold"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-400 font-medium">
        {filteredArticulos.length} {filteredArticulos.length === 1 ? 'producto encontrado' : 'productos encontrados'}
      </p>

      <div className="relative min-h-[300px]">
        <AnimatePresence mode="popLayout">
          {filteredArticulos.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {filteredArticulos.map((art) => (
                <ProductCard
                  key={art.id}
                  slug={slugify(art.data.nombre)}
                  nombre={art.data.nombre}
                  linkAmazon={art.data.linkAmazon}
                  imagen={art.data.imagen}
                  descripcion={art.data.descripcion}
                  precio={art.data.precio}
                  precioOriginal={art.data.precioOriginal}
                  descuentoPct={art.data.descuentoPct}
                  categoria={art.data.categoria}
                  marca={art.data.marca}
                  valoracion={art.data.valoracion}
                  valoracionesCount={art.data.valoracionesCount}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 px-6 bg-neutral-50 rounded-xl border border-neutral-200 text-center"
            >
              <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-300 mb-4">
                <Search size={28} />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-1 font-serif">No encontramos resultados</h3>
              <p className="text-neutral-400 text-sm max-w-md mx-auto">
                Prueba a quitar algún filtro o cambiar los términos de búsqueda.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory(null);
                  handleClear();
                }}
                className="mt-5 px-5 py-2.5 bg-navy-700 text-white text-sm font-bold rounded-lg hover:bg-navy-800 transition-colors"
              >
                Limpiar filtros
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

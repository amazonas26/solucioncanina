import React, { useEffect, useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple slugify for SearchableGrid internal use
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
  };
  id: string;
}

interface SearchableGridProps {
  articulos: Articulo[];
}

export default function SearchableGrid({ articulos }: SearchableGridProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    // Check URL params
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

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    articulos.forEach((art) => {
      if (art.data.categoria) cats.add(art.data.categoria);
    });
    return Array.from(cats).sort();
  }, [articulos]);

  // Filter articles based on search and category
  const filteredArticulos = useMemo(() => {
    return articulos.filter((art) => {
      const matchesSearch =
        art.data.nombre.toLowerCase().includes(search.toLowerCase()) ||
        art.data.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
        art.data.marca?.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = selectedCategory
        ? art.data.categoria === selectedCategory
        : true;

      return matchesSearch && matchesCategory;
    });
  }, [articulos, search, selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Filters Section */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Search Bar */}
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

          {/* Categories Label (Desktop) */}
          <div className="hidden lg:flex items-center gap-1.5 text-neutral-400 font-semibold text-xs uppercase tracking-wider">
            <SlidersHorizontal size={14} />
            Filtrar por categoría
          </div>
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-2" id="category-filters">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200",
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
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                cat === selectedCategory
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-neutral-400 font-medium">
        {filteredArticulos.length} {filteredArticulos.length === 1 ? 'producto encontrado' : 'productos encontrados'}
      </p>

      {/* Grid */}
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
                No hay artículos que coincidan con "{search}" en esta categoría. Intenta con otros términos.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory(null);
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

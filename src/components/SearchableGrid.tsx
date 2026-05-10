import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Articulo {
  data: {
    nombre: string;
    linkAmazon: string;
    imagen?: string;
    descripcion?: string;
    precio?: string;
    categoria?: string;
    marca?: string;
  };
  slug: string;
}

interface SearchableGridProps {
  articulos: Articulo[];
}

export default function SearchableGrid({ articulos }: SearchableGridProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    <div className="space-y-12">
      {/* Filters Section */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
          {/* Search Bar */}
          <div className="relative w-full lg:max-w-md group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Busca productos, marcas o categorías..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 shadow-sm transition-all text-slate-900 placeholder:text-slate-400 font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Categories Label (Desktop) */}
          <div className="hidden lg:flex items-center gap-2 text-slate-400 font-semibold text-sm uppercase tracking-wider">
            <SlidersHorizontal size={16} />
            Filtrar por categoría
          </div>
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300",
              !selectedCategory
                ? "bg-slate-900 text-white shadow-lg shadow-slate-200 scale-105"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            )}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300",
                cat === selectedCategory
                  ? "bg-primary-600 text-white shadow-lg shadow-primary-200 scale-105"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="popLayout">
          {filteredArticulos.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10"
            >
              {filteredArticulos.map((art) => (
                <ProductCard
                  key={art.slug}
                  nombre={art.data.nombre}
                  linkAmazon={art.data.linkAmazon}
                  imagen={art.data.imagen}
                  descripcion={art.data.descripcion}
                  precio={art.data.precio}
                  categoria={art.data.categoria}
                  marca={art.data.marca}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-24 px-6 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center"
            >
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                <Search size={40} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 mb-2">No encontramos resultados</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                No hay artículos que coincidan con "{search}" en esta categoría. Intenta con otros términos o limpia los filtros.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory(null);
                }}
                className="mt-8 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-primary-600 transition-colors shadow-lg shadow-slate-200"
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

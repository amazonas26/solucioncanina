import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

type Props = {
  categories: string[];
};

function emit(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export default function HeaderCatalogControls({ categories }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>('Todos');
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  const displayCats = useMemo(() => {
    const uniq = Array.from(new Set(categories.filter(Boolean)));
    uniq.sort((a, b) => a.localeCompare(b, 'es'));
    return ['Todos', ...uniq];
  }, [categories]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Keep body scroll consistent when the panel is open
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex items-center gap-4 w-full">
      {/* Hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 backdrop-blur-md border border-white/60 shadow-sm hover:bg-white transition-colors focus:outline-none focus:ring-4 focus:ring-primary-500/10"
        aria-label="Abrir catálogo"
      >
        <span className="sr-only">Abrir catálogo</span>
        <span className="relative block h-5 w-6">
          <span className="absolute left-0 top-0 h-0.5 w-full rounded-full bg-slate-700" />
          <span className="absolute left-0 top-2 h-0.5 w-full rounded-full bg-slate-700" />
          <span className="absolute left-0 top-4 h-0.5 w-full rounded-full bg-slate-700" />
        </span>
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-2xl">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
          <Search size={18} />
        </div>
        <input
          type="search"
          placeholder="Buscar productos, marcas, categorías o tiendas…"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            emit('sc:search', { query: v });
          }}
          className="w-full h-11 pl-11 pr-10 bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-400 text-slate-900 placeholder:text-slate-400 font-semibold"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              emit('sc:search', { query: '' });
            }}
            className="absolute inset-y-0 right-3 flex items-center justify-center h-11 w-10 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Drawer (portal to <body> to avoid fixed-position clipping) */}
      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[70]">
            <div
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[92vw] max-w-[420px] bg-white shadow-2xl border-r border-slate-200 z-[71]">
              <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 bg-white">
                <div className="font-black tracking-tight text-slate-900 text-base">
                  Catálogo
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-600"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="h-[calc(100%-4rem)] overflow-auto">
                <div className="p-4">
                  <div className="text-[11px] font-black tracking-widest uppercase text-slate-400 mb-3">
                    Categorías
                  </div>
                  <div className="space-y-1">
                    {displayCats.map((cat) => {
                      const isActive = cat === active;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setActive(cat);
                            emit('sc:category', { category: cat === 'Todos' ? null : cat });
                            setOpen(false);
                          }}
                          className={[
                            'w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left font-bold transition-colors',
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'hover:bg-slate-50 text-slate-700',
                          ].join(' ')}
                        >
                          <span>{cat}</span>
                          <span className="text-slate-300">›</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}


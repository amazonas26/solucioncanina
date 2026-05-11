import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ChevronRight } from 'lucide-react';

type Props = {
  categories: string[];
};

function emit(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

declare global {
  interface Window {
    __sc?: {
      search?: string;
      category?: string | null;
    };
  }
}

export default function HeaderCatalogControls({ categories }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>('Todos');
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  };

  const displayCats = useMemo(() => {
    const uniq = Array.from(new Set(categories.filter(Boolean)));
    uniq.sort((a, b) => a.localeCompare(b, 'es'));
    return ['Todos', ...uniq];
  }, [categories]);

  useEffect(() => {
    setMounted(true);
    // Determine active category from URL
    const path = window.location.pathname;
    if (path === '/') {
      setActive('Todos');
    } else if (path.startsWith('/categoria/')) {
      const slug = path.split('/').pop();
      const found = displayCats.find(c => slugify(c) === slug);
      if (found) setActive(found);
    }
  }, [displayCats]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Hamburger - Hidden on Desktop (lg) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-lg bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 shrink-0"
        aria-label="Abrir catálogo"
        id="catalog-hamburger"
      >
        <span className="sr-only">Abrir catálogo</span>
        <span className="relative block h-4 w-5">
          <span className="absolute left-0 top-0 h-[2px] w-full rounded-full bg-neutral-600" />
          <span className="absolute left-0 top-[7px] h-[2px] w-full rounded-full bg-neutral-600" />
          <span className="absolute left-0 top-[14px] h-[2px] w-full rounded-full bg-neutral-600" />
        </span>
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-400">
          <Search size={16} />
        </div>
        <input
          type="search"
          placeholder="Buscar productos…"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            window.__sc = window.__sc || {};
            window.__sc.search = v;
            emit('sc:search', { query: v });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && window.location.pathname !== '/') {
              // Redirect to home with search query if not on home
              window.location.href = `/?search=${encodeURIComponent(query)}#articulos`;
            }
          }}
          className="w-full h-9 pl-9 pr-8 bg-neutral-50 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-sm text-neutral-900 placeholder:text-neutral-400 font-medium transition-colors"
          id="header-search"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              window.__sc = window.__sc || {};
              window.__sc.search = '';
              emit('sc:search', { query: '' });
            }}
            className="absolute inset-y-0 right-2 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Drawer */}
      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[70]">
            <div
              className="absolute inset-0 bg-neutral-900/40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[85vw] max-w-[380px] bg-white shadow-xl z-[71]">
              <div className="flex items-center justify-between px-4 h-14 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="" className="w-6 h-6 object-contain" />
                  <span className="font-bold text-neutral-900 text-sm">Catálogo</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-neutral-50 text-neutral-500"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="h-[calc(100%-3.5rem)] overflow-auto">
                <div className="p-4">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 mb-2">
                    Categorías
                  </div>
                  <div className="space-y-0.5">
                    {displayCats.map((cat) => {
                      const isActive = cat === active;
                      const href = cat === 'Todos' ? '/' : `/categoria/${slugify(cat)}`;
                      return (
                        <a
                          key={cat}
                          href={href}
                          className={[
                            'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm font-semibold transition-colors',
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'hover:bg-neutral-50 text-neutral-700',
                          ].join(' ')}
                        >
                          <span>{cat}</span>
                          <ChevronRight size={14} className="text-neutral-300" />
                        </a>
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

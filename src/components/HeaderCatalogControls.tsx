import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ChevronRight, ArrowRight } from 'lucide-react';

type SearchItem = {
  slug: string;
  nombre: string;
  marca: string;
  categoria: string;
  imagen: string;
  precio: string;
  descuentoPct: number | null;
};

type Props = {
  categories: string[];
  searchIndex?: SearchItem[];
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

const MAX_SUGGESTIONS = 6;

export default function HeaderCatalogControls({ categories, searchIndex = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>('Todos');
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  // Estat del dropdown de suggeriments
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  // Suggeriments en temps real basats en el query.
  // Coincidencia per nom, marca o categoria (insensible a accents/majúscules).
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !searchIndex.length) return [] as SearchItem[];

    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const nq = norm(q);

    const scored: { item: SearchItem; score: number }[] = [];
    for (const item of searchIndex) {
      const nombre = norm(item.nombre);
      const marca = norm(item.marca);
      const categoria = norm(item.categoria);

      let score = 0;
      if (nombre.startsWith(nq)) score = 100;
      else if (marca.startsWith(nq)) score = 90;
      else if (nombre.includes(nq)) score = 70;
      else if (marca.includes(nq)) score = 60;
      else if (categoria.includes(nq)) score = 40;

      if (score > 0) scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_SUGGESTIONS).map((s) => s.item);
  }, [query, searchIndex]);

  // Total de coincidències (per al footer "Ver todos los N resultados")
  const totalMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !searchIndex.length) return 0;
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const nq = norm(q);
    return searchIndex.filter(
      (i) => norm(i.nombre).includes(nq) || norm(i.marca).includes(nq) || norm(i.categoria).includes(nq),
    ).length;
  }, [query, searchIndex]);

  useEffect(() => {
    setMounted(true);
    const path = window.location.pathname;
    if (path === '/productos' || path === '/') {
      setActive('Todos');
    } else if (path.startsWith('/categoria/')) {
      const slug = path.split('/').pop();
      const found = displayCats.find((c) => slugify(c) === slug);
      if (found) setActive(found);
    }

    // Recupera query inicial des de la URL (?search=...)
    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get('search');
    if (urlSearch) {
      setQuery(urlSearch);
      window.__sc = window.__sc || {};
      window.__sc.search = urlSearch;
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

  // Tancar dropdown al click fora o pulsant Escape
  useEffect(() => {
    if (!dropdownOpen) return;

    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(t) &&
        inputRef.current && !inputRef.current.contains(t)
      ) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [dropdownOpen]);

  // Reset highlight quan canvien els suggeriments
  useEffect(() => {
    setHighlight(-1);
  }, [suggestions.length]);

  // Si estem a la home, fer scroll suau al catàleg quan l'usuari executa la cerca
  const scrollToCatalog = () => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== '/productos') return;
    const el = document.getElementById('articulos');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleChange = (v: string) => {
    setQuery(v);
    window.__sc = window.__sc || {};
    window.__sc.search = v;
    emit('sc:search', { query: v });
    setDropdownOpen(v.trim().length >= 2);
  };

  const handleClear = () => {
    setQuery('');
    window.__sc = window.__sc || {};
    window.__sc.search = '';
    emit('sc:search', { query: '' });
    setDropdownOpen(false);
  };

  // Navegar a un producte concret
  const goToProduct = (slug: string) => {
    window.location.href = `/producto/${slug}`;
  };

  const goToAllResults = () => {
    const q = query.trim();
    if (!q) return;
    if (window.location.pathname === '/productos') {
      // Ja som a la pàgina de productes: emet l'event i fa scroll. No recarrega.
      emit('sc:search', { query: q });
      setDropdownOpen(false);
      // petit timeout perquè el grid faci el re-render abans de l'scroll
      setTimeout(scrollToCatalog, 60);
    } else {
      window.location.href = `/productos?search=${encodeURIComponent(q)}#articulos`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length)); // +1 perquè l'últim és "veure tots"
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownOpen && suggestions.length > 0 && highlight >= 0 && highlight < suggestions.length) {
        goToProduct(suggestions[highlight].slug);
      } else {
        goToAllResults();
      }
    }
  };

  const showDropdown = dropdownOpen && query.trim().length >= 2;

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Hamburger - només mòbil/tablet */}
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

      {/* Cerca + dropdown */}
      <div className="relative flex-1 max-w-xl">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-400">
          <Search size={16} />
        </div>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          placeholder="Buscar productos…"
          value={query}
          onFocus={() => {
            if (query.trim().length >= 2) setDropdownOpen(true);
          }}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className="w-full h-9 pl-9 pr-8 bg-neutral-50 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-sm text-neutral-900 placeholder:text-neutral-400 font-medium transition-colors"
          id="header-search"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-2 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}

        {/* Dropdown de suggeriments */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-neutral-200 shadow-2xl overflow-hidden z-[60]"
          >
            {suggestions.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm">
                <p className="text-neutral-500 mb-1">
                  No encontramos productos para "<strong className="text-neutral-900">{query}</strong>"
                </p>
                <p className="text-xs text-neutral-400">
                  Prueba con otra palabra (nombre, marca o categoría).
                </p>
              </div>
            ) : (
              <>
                <ul className="max-h-[60vh] overflow-y-auto py-1.5">
                  {suggestions.map((s, idx) => {
                    const isHL = idx === highlight;
                    return (
                      <li key={s.slug} role="option" aria-selected={isHL}>
                        <a
                          href={`/producto/${s.slug}`}
                          onMouseEnter={() => setHighlight(idx)}
                          className={[
                            'flex items-center gap-3 px-3 py-2.5 transition-colors',
                            isHL ? 'bg-primary-50' : 'hover:bg-neutral-50',
                          ].join(' ')}
                        >
                          <div className="w-11 h-11 rounded-md bg-neutral-100 overflow-hidden flex-shrink-0 border border-neutral-200">
                            {s.imagen ? (
                              <img
                                src={s.imagen}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-neutral-900 truncate">
                              {s.nombre}
                            </div>
                            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider truncate">
                              {[s.marca, s.categoria].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            {s.precio && (
                              <span className="text-sm font-extrabold text-neutral-900">
                                {s.precio}
                              </span>
                            )}
                            {typeof s.descuentoPct === 'number' && s.descuentoPct > 0 && (
                              <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">
                                -{s.descuentoPct}%
                              </span>
                            )}
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={goToAllResults}
                  onMouseEnter={() => setHighlight(suggestions.length)}
                  className={[
                    'w-full flex items-center justify-between gap-2 px-4 py-3 border-t border-neutral-100 text-sm font-bold transition-colors',
                    highlight === suggestions.length
                      ? 'bg-primary-50 text-primary-700'
                      : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100',
                  ].join(' ')}
                >
                  <span>
                    Ver todos los resultados ({totalMatches})
                  </span>
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Drawer mòbil */}
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
                      const href = cat === 'Todos' ? '/productos' : `/categoria/${slugify(cat)}`;
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
          document.body,
        )}
    </div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';

interface ProductCardProps {
  slug: string;
  nombre: string;
  linkAmazon?: string;
  imagen?: string;
  descripcion?: string;
  precio?: string;
  precioOriginal?: string;
  descuentoPct?: number;
  categoria?: string;
  marca?: string;
  valoracion?: number;
  valoracionesCount?: number;
  rank?: number;
}

const fmtCount = (n?: number) => {
  if (!n || n <= 0) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString('es-ES');
};

/** Misma política que `find_new_products.py` / `update_prices.py` (≥3,7). */
const MIN_VISIBLE_RATING = 3.7;
const showsRating = (v: number | undefined): v is number =>
  typeof v === 'number' && v >= MIN_VISIBLE_RATING;

export const ProductCard: React.FC<ProductCardProps> = ({
  slug,
  nombre,
  imagen,
  precio,
  precioOriginal,
  descuentoPct,
  marca,
  valoracion,
  valoracionesCount,
  rank,
}) => {
  const imageUrl = imagen || '/logo.png';
  const detailUrl = `/producto/${slug}/`;

  return (
    <motion.article
      layout
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col h-full"
    >
      <div className="relative aspect-square bg-neutral-50 flex items-center justify-center p-4 sm:p-5 overflow-hidden">
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="max-w-full max-h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {rank && (
          <span className="absolute top-2 left-3 font-serif text-[2.4rem] leading-none font-semibold text-clay-600 tabular-nums" aria-label={`Número ${rank}`}>
            {rank}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-grow pt-3">
        {marca && (
          <p className="text-[11px] sm:text-xs text-neutral-500 truncate">
            {marca}
            {['ADVANCE', 'LENDA', 'ARTERO'].includes(marca.toUpperCase()) && ' · marca española'}
          </p>
        )}
        <h3 className="mt-1 font-serif text-base sm:text-[1.15rem] leading-snug font-semibold text-neutral-900 line-clamp-3">
          <a href={detailUrl} className="after:absolute after:inset-0 group-hover:underline decoration-1 underline-offset-4">
            {nombre}
          </a>
        </h3>

        {(precio || showsRating(valoracion)) && (
          <div className="mt-auto pt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            {precio ? (
              <div className="min-w-0">
                <span className="block text-[15px] sm:text-[1.05rem] font-bold text-neutral-900 tabular-nums leading-tight">{precio}</span>
                {precioOriginal && (
                  <span className="block text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                    <s>{precioOriginal}</s>
                    {typeof descuentoPct === 'number' && descuentoPct > 0 && (
                      <span className="ml-1 font-semibold text-clay-600">−{descuentoPct} %</span>
                    )}
                  </span>
                )}
              </div>
            ) : (
              <span />
            )}
            {showsRating(valoracion) && (
              <span
                className="shrink-0 text-xs sm:text-sm text-neutral-700 tabular-nums"
                title="Valoración en Amazon"
                aria-label={`Valoración en Amazon: ${valoracion.toFixed(1)} sobre 5${valoracionesCount ? ` con ${valoracionesCount} reseñas` : ''}`}
              >
                <span className="text-[#d99a1e]" aria-hidden="true">★</span> {valoracion.toFixed(1)}
                {fmtCount(valoracionesCount) && (
                  <span className="hidden sm:inline text-xs text-neutral-500"> ({fmtCount(valoracionesCount)})</span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
};

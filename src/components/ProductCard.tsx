import React from 'react';
import { Package } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProductCardProps {
  slug: string;
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
  linkAmazon,
  imagen,
  descripcion,
  precio,
  precioOriginal,
  descuentoPct,
  categoria,
  marca,
  valoracion,
  valoracionesCount,
}) => {
  const imageUrl = imagen || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=800&h=600';
  const detailUrl = `/producto/${slug}`;

  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-200 border border-neutral-200"
    >
      {/* Image Container */}
      <a href={detailUrl} className="aspect-[4/3] w-full bg-neutral-100 overflow-hidden relative block">
        <img
          src={imageUrl}
          alt={nombre}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Category Badge */}
        {categoria && (
          <div className="absolute top-3 left-3 z-10">
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/95 text-neutral-600 rounded-md shadow-sm border border-neutral-100">
              {categoria}
            </span>
          </div>
        )}

        {/* Discount Badge */}
        {typeof descuentoPct === 'number' && descuentoPct > 0 && (
          <div className="absolute top-0 right-4 z-10">
            <div
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)' }}
              className="flex flex-col items-center justify-center w-10 pt-2 pb-4 bg-gradient-to-b from-red-600 to-red-500 shadow-lg shadow-red-500/40"
            >
              <span className="text-[9px] font-black text-white/80 uppercase tracking-widest leading-none mb-0.5">OFF</span>
              <span className="text-sm font-black text-white leading-none">{descuentoPct}%</span>
            </div>
          </div>
        )}
      </a>

      {/* Content */}
      <div className="flex flex-col flex-grow p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-1 sm:mb-1.5">
          {marca && (
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              <Package size={8} className="sm:w-2.5 sm:h-2.5" />
              {marca}
            </div>
          )}
          {marca && ['ADVANCE', 'LENDA', 'ARTERO'].includes(marca.toUpperCase()) && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
              🇪🇸 MARCA ESPAÑOLA
            </span>
          )}
          {categoria === 'Alimentación específica' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              🩺 DIETA CLÍNICA
            </span>
          )}
        </div>

        <a href={detailUrl} className="block">
          <h3 className="text-xs sm:text-sm font-bold text-neutral-900 line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug mb-1.5 sm:mb-2 font-serif">
            {nombre}
          </h3>
        </a>

        {/* Description — hidden on smallest mobile if needed, but we can keep it with smaller font */}
        <p className="text-[10px] sm:text-xs text-neutral-400 line-clamp-2 mb-2 sm:mb-3 leading-relaxed h-7 sm:h-8">
          {descripcion || '\u00a0'}
        </p>

        {/* Price + Rating */}
        {(precio || showsRating(valoracion)) && (
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 sm:gap-3 mb-3 pb-3 border-b border-neutral-100">
            {precio ? (
              <div className="flex items-baseline gap-1 sm:gap-2 min-w-0">
                <span className="text-base sm:text-lg font-black text-neutral-900 tabular-nums">
                  {precio}
                </span>
                {precioOriginal && (
                  <span className="text-[10px] sm:text-xs font-bold text-neutral-400 line-through decoration-red-500/20">
                    {precioOriginal}
                  </span>
                )}
              </div>
            ) : (
              <span />
            )}

            {showsRating(valoracion) && (
              <div
                className="flex items-center gap-1 shrink-0"
                aria-label={`Valoración ${valoracion.toFixed(1)} sobre 5${
                  valoracionesCount ? ` con ${valoracionesCount} reseñas` : ''
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="#FACC15"
                  stroke="#EAB308"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0"
                  aria-hidden="true"
                >
                  <polygon points="12,2 14.94,8.96 22.5,9.56 16.74,14.62 18.49,22 12,17.93 5.51,22 7.26,14.62 1.5,9.56 9.06,8.96" />
                </svg>
                <span className="text-xs sm:text-sm font-black text-neutral-900 tabular-nums">
                  {valoracion.toFixed(1)}
                </span>
                {fmtCount(valoracionesCount) && (
                  <span className="text-[10px] sm:text-[11px] font-bold text-neutral-400 tabular-nums hidden sm:inline">
                    ({fmtCount(valoracionesCount)})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto">
          <a
            href={linkAmazon}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="flex items-center justify-center w-full px-2 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-black text-black bg-[#FF9900] hover:bg-[#E68A00] rounded-xl transition-all shadow-sm hover:shadow-orange-500/20 active:scale-[0.98]"
          >
            <span className="hidden xs:inline">Ver mejor precio</span>
            <span className="xs:hidden">Ver precio</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
};

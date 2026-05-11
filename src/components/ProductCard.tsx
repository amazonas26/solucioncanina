import React from 'react';
import { ShoppingCart, ExternalLink, Package } from 'lucide-react';
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
}

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
}) => {
  const imageUrl = imagen || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=800&h=600';
  const detailUrl = `/producto/${slug}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col bg-white rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-200 border border-neutral-200"
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
          <div className="absolute top-3 right-3 z-10">
            <span className="px-2 py-1 text-[11px] font-bold bg-red-500 text-white rounded-md shadow-sm">
              -{descuentoPct}%
            </span>
          </div>
        )}
      </a>

      {/* Content */}
      <div className="flex flex-col flex-grow p-4">
        {marca && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">
            <Package size={10} />
            {marca}
          </div>
        )}

        <a href={detailUrl} className="block">
          <h3 className="text-sm font-bold text-neutral-900 line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug mb-2 font-serif">
            {nombre}
          </h3>
        </a>

        {descripcion && (
          <p className="text-xs text-neutral-400 line-clamp-2 mb-3 leading-relaxed flex-grow">
            {descripcion}
          </p>
        )}

        {/* Price */}
        {precio && (
          <div className="flex items-baseline gap-2 mb-3 pb-3 border-b border-neutral-100">
            <span className="text-lg font-extrabold text-neutral-900">
              {precio}
            </span>
            {precioOriginal && (
              <span className="text-xs font-medium text-neutral-400 line-through">
                {precioOriginal}
              </span>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto flex flex-col gap-2">
          <a
            href={linkAmazon}
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-neutral-800 bg-accent-500 hover:bg-accent-600 rounded-lg transition-colors gap-2"
          >
            <ShoppingCart size={15} strokeWidth={2.5} />
            Ver en Amazon
            <ExternalLink size={12} className="opacity-50" />
          </a>
        </div>
      </div>
    </motion.div>
  );
};

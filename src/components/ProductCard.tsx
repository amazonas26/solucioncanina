import React from 'react';
import { ShoppingCart, ExternalLink, Tag, Package } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProductCardProps {
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      className="group relative flex flex-col bg-white rounded-3xl overflow-hidden shadow-premium hover:shadow-premium-hover transition-all duration-300 border border-slate-100/80"
    >
      {/* Image Container */}
      <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden relative">
        <img
          src={imageUrl}
          alt={nombre}
          className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Category Badge (top-left of image) */}
        {categoria && (
          <div className="absolute top-4 left-4 z-10">
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-white/90 backdrop-blur-md text-primary-700 rounded-2xl shadow-sm border border-primary-100">
              <Tag size={10} />
              {categoria}
            </span>
          </div>
        )}

        {/* Discount Badge (bottom-left of image) */}
        {typeof descuentoPct === 'number' && descuentoPct > 0 && (
          <div className="absolute bottom-3 left-3 z-10">
            <span className="px-2.5 py-1 text-xs font-black uppercase tracking-wider bg-red-500 text-white rounded-lg shadow-lg ring-1 ring-red-600/20">
              -{descuentoPct}%
            </span>
          </div>
        )}

        {/* Price Badge (bottom-right of image) */}
        {precio && (
          <div className="absolute bottom-3 right-3 z-10 flex items-baseline gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg">
            {precioOriginal && (
              <span className="text-[11px] font-medium text-slate-400 line-through whitespace-nowrap">
                {precioOriginal}
              </span>
            )}
            <span className="text-base font-black text-primary-600 whitespace-nowrap">
              {precio}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-grow p-6">
        <h3 className="text-xl font-display font-bold text-slate-900 line-clamp-2 group-hover:text-primary-600 transition-colors leading-tight mb-3">
          {nombre}
        </h3>

        {marca && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            <Package size={12} />
            {marca}
          </div>
        )}

        {descripcion && (
          <p className="text-sm text-slate-500 line-clamp-3 mb-6 leading-relaxed flex-grow">
            {descripcion}
          </p>
        )}

        {/* Action Button */}
        <div className="mt-auto">
          <a
            href={linkAmazon}
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn relative flex items-center justify-center w-full px-6 py-3.5 text-sm font-bold text-white bg-slate-900 hover:bg-primary-600 rounded-2xl transition-all duration-300 shadow-lg shadow-slate-200 hover:shadow-primary-500/25 gap-2 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <ShoppingCart size={18} strokeWidth={2.5} />
              Ver en Amazon
              <ExternalLink size={14} className="opacity-50 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </a>
        </div>
      </div>
    </motion.div>
  );
};

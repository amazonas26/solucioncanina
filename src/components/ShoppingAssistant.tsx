import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from './ProductCard';
import { 
  Baby, Dog, Activity, 
  Minimize2, Expand, Maximize2, 
  Bone, Map, Zap, Drumstick, 
  ArrowLeft, CheckCircle2, RotateCcw,
  Coins, Wallet, Gem
} from 'lucide-react';
import { notaPrecios } from '../utils/precioConsultado';

type Article = {
  id: string;
  slug: string;
  data: {
    nombre: string;
    nombreCorto?: string;
    descripcion?: string;
    imagen?: string;
    precio?: string;
    precioOriginal?: string;
    descuentoPct?: number;
    ventas?: number;
    linkAmazon: string;
    categoria?: string;
    marca?: string;
    veredicto?: string;
    analisis?: string;
    pros?: string[];
    contras?: string[];
    paraQuien?: string;
  };
};

interface Props {
  articulos: Article[];
}

const QUESTIONS = [
  {
    id: 'intro',
    title: 'Encontremos lo mejor para tu perro',
    subtitle: 'Responde 4 preguntas rápidas y te recomendaremos los productos exactos para mejorar su calidad de vida.',
    options: [{ label: 'Empezar el test', value: 'start' }],
  },
  {
    id: 'edad',
    title: '¿Qué edad tiene tu perro?',
    subtitle: 'Las necesidades nutricionales y físicas cambian con la edad.',
    options: [
      { label: 'Cachorro', value: 'cachorro', icon: <Baby size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Menos de 1 año' },
      { label: 'Adulto', value: 'adulto', icon: <Dog size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'De 1 a 7 años' },
      { label: 'Senior', value: 'senior', icon: <Activity size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Más de 7 años' },
    ],
  },
  {
    id: 'tamano',
    title: '¿Cuál es su tamaño aproximado?',
    subtitle: 'Importante para elegir correas, camas o dosis de suplementos.',
    options: [
      { label: 'Pequeño', value: 'pequeno', icon: <Minimize2 size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Menos de 10 kg' },
      { label: 'Mediano', value: 'mediano', icon: <Expand size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'De 10 a 25 kg' },
      { label: 'Grande', value: 'grande', icon: <Maximize2 size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Más de 25 kg' },
    ],
  },
  {
    id: 'objetivo',
    title: '¿En qué área necesitas más ayuda hoy?',
    subtitle: 'Selecciona la principal preocupación o necesidad.',
    options: [
      { label: 'Descanso y movilidad', value: 'movilidad', icon: <Bone size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Camas, rampas, articulaciones' },
      { label: 'Paseo y educación', value: 'paseo', icon: <Map size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Tirones, bozales, collares' },
      { label: 'Ansiedad y miedos', value: 'ansiedad', icon: <Zap size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Tormentas, separación, estrés' },
      { label: 'Alimentación y digestión', value: 'alimentacion', icon: <Drumstick size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Dietas especiales, suplementos' },
    ],
  },
  {
    id: 'presupuesto',
    title: '¿Cuánto tienes pensado invertir?',
    subtitle: 'Nos ayuda a recomendarte opciones dentro de tu rango de precios.',
    options: [
      { label: 'Económico', value: 'economico', icon: <Coins size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Prioridad al mejor precio' },
      { label: 'Calidad-Precio', value: 'medio', icon: <Wallet size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'Opciones equilibradas' },
      { label: 'Premium', value: 'premium', icon: <Gem size={36} strokeWidth={1.5} className="text-primary-600" />, desc: 'La mejor calidad posible' },
    ],
  },
];

export default function ShoppingAssistant({ articulos }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleOptionClick = (optionValue: string) => {
    if (step === 0) {
      setStep(1);
      return;
    }

    const currentQuestion = QUESTIONS[step];
    const newAnswers = { ...answers, [currentQuestion.id]: optionValue };
    setAnswers(newAnswers);

    setStep(step + 1);
  };

  const getRecommendations = () => {
    let scoredArticles = articulos.map(art => {
      let score = 0;
      const cat = art.data.categoria?.toLowerCase() || '';
      const name = [art.data.nombreCorto, art.data.nombre]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const desc = art.data.descripcion?.toLowerCase() || '';

      // AGE LOGIC
      if (answers.edad === 'senior') {
        if (cat.includes('senior') || name.includes('senior')) score += 15;
        if (cat.includes('ortopédica') || cat.includes('rampas')) score += 10;
        // Negative matches
        if (cat.includes('cachorro') || name.includes('cachorro') || name.includes('puppy')) score -= 50;
      }
      
      if (answers.edad === 'cachorro') {
        if (cat.includes('cachorro') || name.includes('cachorro') || name.includes('puppy')) score += 15;
        if (cat.includes('educación') || cat.includes('empapadores')) score += 10;
        // Negative matches
        if (cat.includes('senior') || name.includes('senior') || name.includes('adult')) score -= 50;
      }
      
      if (answers.edad === 'adulto') {
        if (name.includes('adult') || name.includes('adulto')) score += 5;
        if (cat.includes('cachorro') || name.includes('puppy') || name.includes('senior')) score -= 20;
      }

      // SIZE LOGIC
      if (answers.tamano === 'grande') {
        if (name.match(/\b(l|xl|xxl|grande|maxi)\b/i)) score += 10;
        if (name.match(/\b(s|xs|mini|pequeño|pequeña)\b/i)) score -= 30;
      }
      
      if (answers.tamano === 'pequeno') {
        if (name.match(/\b(s|xs|mini|pequeño|pequeña)\b/i)) score += 10;
        if (name.match(/\b(l|xl|xxl|grande|maxi)\b/i)) score -= 30;
      }
      
      if (answers.tamano === 'mediano') {
        if (name.match(/\b(m|mediano|medium)\b/i)) score += 5;
      }

      // OBJECTIVE LOGIC
      if (answers.objetivo === 'movilidad') {
        if (cat.includes('camas') || cat.includes('rampas') || cat.includes('articulaciones') || name.includes('condro')) score += 30;
        if (desc.includes('articulaciones') || desc.includes('movilidad')) score += 15;
      }
      
      if (answers.objetivo === 'paseo') {
        if (cat.includes('correas') || cat.includes('bozales') || cat.includes('arneses') || name.includes('arnés') || name.includes('collar')) score += 30;
      }
      
      if (answers.objetivo === 'ansiedad') {
        if (cat.includes('ansiedad') || cat.includes('estrés') || name.includes('calming') || name.includes('adaptil') || name.includes('relax')) score += 30;
      }
      
      if (answers.objetivo === 'alimentacion') {
        if (cat.includes('alimentación') || cat.includes('piensos') || cat.includes('suplementos') || cat.includes('snack')) score += 30;
        if (name.includes('digestivo') || name.includes('gastrointestinal')) score += 15;
      }

      // BUDGET LOGIC
      if (answers.presupuesto === 'economico') {
        const p = parseFloat(art.data.precio?.replace('€', '').replace(',', '.') || '0');
        if (p > 0 && p < 25) score += 20;
        if (p > 60) score -= 30; // penalize expensive
      }
      if (answers.presupuesto === 'medio') {
        const p = parseFloat(art.data.precio?.replace('€', '').replace(',', '.') || '0');
        if (p >= 20 && p <= 60) score += 10;
      }
      if (answers.presupuesto === 'premium') {
        const p = parseFloat(art.data.precio?.replace('€', '').replace(',', '.') || '0');
        if (p > 50) score += 20;
        if (cat.includes('ortopédica') || name.includes('premium') || name.includes('pro')) score += 10;
        if (p > 0 && p < 15) score -= 15; // penalize too cheap
      }

      // Base quality and popularity (TIE BREAKERS)
      // Up to 5 bonus points for high ratings
      if (art.data.valoracion) {
        score += (art.data.valoracion); 
      }
      // Small bonus for sales
      if (art.data.ventas) {
        score += Math.min(5, art.data.ventas / 100);
      }
      // Bonus if it has a discount
      if (art.data.descuentoPct && art.data.descuentoPct > 0) {
        score += 2;
      }

      return { ...art, score };
    });

    // Remove poorly matching products (score <= 0)
    scoredArticles = scoredArticles.filter(a => a.score > 0);

    // Sort by score
    scoredArticles.sort((a, b) => b.score - a.score);

    // Return top 6
    return scoredArticles.slice(0, 6);
  };

  const recommended = step >= QUESTIONS.length ? getRecommendations() : [];

  return (
    <div className="w-full max-w-6xl mx-auto min-h-[70vh] flex flex-col items-center justify-center relative px-4">
      <AnimatePresence mode="wait">
        
        {/* Analyzing State */}
        {/* Questions */}
        {step < QUESTIONS.length && (
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full flex flex-col items-center text-center"
          >
            {step > 0 && (
              <div className="mb-6 text-sm font-semibold text-neutral-500">
                Pregunta {step} de {QUESTIONS.length - 1}
              </div>
            )}
            
            <h2 className="text-4xl md:text-5xl font-serif font-black text-neutral-900 mb-4 leading-tight">
              {QUESTIONS[step].title}
            </h2>
            <p className="text-lg md:text-xl text-neutral-500 mb-12 max-w-2xl mx-auto">
              {QUESTIONS[step].subtitle}
            </p>

            <div className={step === 0 
              ? "flex justify-center w-full" 
              : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-5xl mx-auto"
            }>
              {QUESTIONS[step].options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleOptionClick(opt.value)}
                  className={step === 0 
                    ? "bg-navy-700 text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-navy-800 transition-colors cursor-pointer"
                    : "relative group flex text-left flex-col bg-white p-5 rounded-lg border-2 border-neutral-200 hover:border-primary-500 hover:bg-primary-50/40 transition-colors cursor-pointer"
                  }
                >
                  <div className="relative z-10 w-full">
                    {opt.icon && <span className="mb-3 block">{opt.icon}</span>}
                    <span className={`block font-black ${step === 0 ? 'text-xl' : 'text-lg text-neutral-900'} mb-1.5 leading-tight`}>{opt.label}</span>
                    {opt.desc && <span className="block text-sm text-neutral-500 font-medium group-hover:text-primary-700 transition-colors">{opt.desc}</span>}
                  </div>
                </button>
              ))}
            </div>

            {step > 0 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="mt-12 text-sm text-neutral-400 hover:text-neutral-900 transition-colors font-medium flex items-center gap-1"
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
                Volver a la pregunta anterior
              </button>
            )}
          </motion.div>
        )}

        {/* Results */}
        {step >= QUESTIONS.length && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full"
          >
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-6 ring-8 ring-green-50 shadow-sm">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-4xl md:text-5xl font-serif font-black text-neutral-900 mb-6">
                Tus recomendaciones perfectas
              </h2>
              <div className="inline-flex flex-wrap justify-center gap-2 text-sm md:text-base text-neutral-600 font-medium bg-neutral-100 px-6 py-3 rounded-full border border-neutral-200 capitalize">
                <span>{answers.edad}</span>
                <span className="text-neutral-300">•</span>
                <span>{answers.tamano}</span>
                <span className="text-neutral-300">•</span>
                <span>{answers.objetivo}</span>
                {answers.presupuesto && (
                  <>
                    <span className="text-neutral-300">•</span>
                    <span>{answers.presupuesto}</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 md:gap-8">
              {recommended.map((art, index) => (
                <motion.div 
                  key={art.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + (index * 0.1) }}
                  className="relative"
                >
                  <p className="mb-2 text-sm font-semibold text-neutral-600">
                    {index === 0 ? 'La que más encaja' : `Opción ${index + 1}`}
                  </p>
                  <div className={index === 0 ? "h-full ring-2 ring-primary-500 rounded-xl" : "h-full"}>
                    <ProductCard 
                      slug={art.slug}
                      nombre={art.data.nombreCorto || art.data.nombre}
                      imagen={art.data.imagen}
                      precio={art.data.precio}
                      precioOriginal={art.data.precioOriginal}
                      descuentoPct={art.data.descuentoPct}
                      categoria={art.data.categoria}
                      linkAmazon={art.data.linkAmazon}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
            {notaPrecios(recommended.map((art) => art.slug)) && (
              <p className="mt-6 text-center text-[11px] text-neutral-400">
                {notaPrecios(recommended.map((art) => art.slug))}
              </p>
            )}

            <div className="mt-20 text-center">
              <button 
                onClick={() => { setStep(0); setAnswers({}); }}
                className="inline-flex items-center gap-2 text-neutral-500 font-bold hover:text-neutral-900 transition-colors bg-white border-2 border-neutral-200 px-6 py-3 rounded-xl hover:border-neutral-300"
              >
                <RotateCcw size={18} strokeWidth={2.5} />
                Volver a hacer el test
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

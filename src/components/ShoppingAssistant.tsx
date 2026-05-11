import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from './ProductCard';

type Article = {
  id: string;
  slug: string;
  data: {
    nombre: string;
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
    subtitle: 'Responde 3 preguntas rápidas y te recomendaremos los productos exactos para mejorar su calidad de vida.',
    options: [{ label: 'Empezar el test', value: 'start' }],
  },
  {
    id: 'edad',
    title: '¿Qué edad tiene tu perro?',
    subtitle: 'Las necesidades nutricionales y físicas cambian con la edad.',
    options: [
      { label: 'Cachorro', value: 'cachorro', icon: '🍼', desc: 'Menos de 1 año' },
      { label: 'Adulto', value: 'adulto', icon: '🐕', desc: 'De 1 a 7 años' },
      { label: 'Senior', value: 'senior', icon: '👴', desc: 'Más de 7 años' },
    ],
  },
  {
    id: 'tamano',
    title: '¿Cuál es su tamaño aproximado?',
    subtitle: 'Importante para elegir correas, camas o dosis de suplementos.',
    options: [
      { label: 'Pequeño', value: 'pequeno', icon: '🤏', desc: 'Menos de 10 kg' },
      { label: 'Mediano', value: 'mediano', icon: '🐶', desc: 'De 10 a 25 kg' },
      { label: 'Grande', value: 'grande', icon: '🐺', desc: 'Más de 25 kg' },
    ],
  },
  {
    id: 'objetivo',
    title: '¿En qué área necesitas más ayuda hoy?',
    subtitle: 'Selecciona la principal preocupación o necesidad.',
    options: [
      { label: 'Descanso y Movilidad', value: 'movilidad', icon: '🦴', desc: 'Camas, rampas, articulaciones' },
      { label: 'Paseo y Educación', value: 'paseo', icon: '🦮', desc: 'Tirones, bozales, collares' },
      { label: 'Ansiedad y Miedos', value: 'ansiedad', icon: '⚡', desc: 'Tormentas, separación, estrés' },
      { label: 'Alimentación y Digestión', value: 'alimentacion', icon: '🥩', desc: 'Dietas especiales, suplementos' },
    ],
  },
];

export default function ShoppingAssistant({ articulos }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleOptionClick = (optionValue: string) => {
    if (step === 0) {
      setStep(1);
      return;
    }

    const currentQuestion = QUESTIONS[step];
    const newAnswers = { ...answers, [currentQuestion.id]: optionValue };
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // Finished
      setIsAnalyzing(true);
      setTimeout(() => {
        setStep(step + 1);
        setIsAnalyzing(false);
      }, 2000); // Fake analyzing delay for 'cool' effect
    }
  };

  const getRecommendations = () => {
    // Basic recommendation logic based on answers
    
    let scoredArticles = articulos.map(art => {
      let score = 0;
      const cat = art.data.categoria?.toLowerCase() || '';
      const name = art.data.nombre.toLowerCase();
      const desc = art.data.descripcion?.toLowerCase() || '';

      // Age logic
      if (answers.edad === 'senior' && (cat.includes('senior') || name.includes('senior') || cat.includes('camas ortopédicas') || cat.includes('rampas'))) score += 5;
      if (answers.edad === 'cachorro' && (name.includes('cachorro') || desc.includes('cachorro') || cat.includes('educación'))) score += 5;

      // Size logic
      if (answers.tamano === 'grande' && (name.includes('l') || name.includes('xl') || name.includes('grande'))) score += 2;
      if (answers.tamano === 'pequeno' && (name.includes('s') || name.includes('pequeño') || name.includes('pequeña'))) score += 2;

      // Objective logic
      if (answers.objetivo === 'movilidad' && (cat.includes('camas') || cat.includes('rampas') || cat.includes('suplementos') || name.includes('condro'))) score += 10;
      if (answers.objetivo === 'paseo' && (cat.includes('correas') || cat.includes('bozales') || name.includes('arnés'))) score += 10;
      if (answers.objetivo === 'ansiedad' && (cat.includes('ansiedad') || name.includes('calming') || desc.includes('estrés'))) score += 10;
      if (answers.objetivo === 'alimentacion' && (cat.includes('alimentación') || cat.includes('suplementos') || name.includes('salmon'))) score += 10;

      // Bonus for top sellers to break ties
      if (art.data.ventas) score += (art.data.ventas / 1000);

      return { ...art, score };
    });

    // Sort by score
    scoredArticles.sort((a, b) => b.score - a.score);

    // Return top 3
    return scoredArticles.slice(0, 3);
  };

  const recommended = step >= QUESTIONS.length ? getRecommendations() : [];

  return (
    <div className="w-full max-w-4xl mx-auto min-h-[70vh] flex flex-col items-center justify-center relative px-4">
      <AnimatePresence mode="wait">
        
        {/* Analyzing State */}
        {isAnalyzing && (
          <motion.div 
            key="analyzing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center text-center space-y-6"
          >
            <div className="relative w-24 h-24">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-full h-full rounded-full border-4 border-neutral-100 border-t-primary-500 border-r-primary-500"
              />
              <div className="absolute inset-0 flex items-center justify-center text-3xl">
                ✨
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-neutral-900 mb-2">Analizando opciones...</h2>
              <p className="text-neutral-500">Buscando las mejores soluciones en nuestro catálogo</p>
            </div>
          </motion.div>
        )}

        {/* Questions */}
        {!isAnalyzing && step < QUESTIONS.length && (
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full flex flex-col items-center text-center"
          >
            {step > 0 && (
              <div className="mb-8 text-sm font-bold text-primary-500 tracking-wider uppercase bg-primary-50 px-4 py-1 rounded-full border border-primary-100">
                Pregunta {step} de {QUESTIONS.length - 1}
              </div>
            )}
            
            <h2 className="text-4xl md:text-5xl font-serif font-black text-neutral-900 mb-4 leading-tight">
              {QUESTIONS[step].title}
            </h2>
            <p className="text-lg md:text-xl text-neutral-500 mb-12 max-w-2xl mx-auto">
              {QUESTIONS[step].subtitle}
            </p>

            <div className={`grid gap-5 w-full max-w-2xl ${step === 0 ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 md:grid-cols-2'}`}>
              {QUESTIONS[step].options.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => handleOptionClick(opt.value)}
                  className={`relative overflow-hidden group flex ${step === 0 ? 'justify-center items-center bg-navy-700 text-white' : 'text-left flex-col bg-white'} p-6 md:p-8 rounded-2xl border-2 ${step === 0 ? 'border-navy-700' : 'border-neutral-200'} hover:border-primary-500 hover:shadow-xl transition-all hover:-translate-y-1.5`}
                >
                  {step !== 0 && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  
                  <div className="relative z-10 w-full">
                    {opt.icon && <span className="text-5xl mb-4 block drop-shadow-sm group-hover:scale-110 transition-transform origin-left">{opt.icon}</span>}
                    <span className={`block font-black ${step === 0 ? 'text-xl' : 'text-2xl text-neutral-900'} mb-2 leading-tight`}>{opt.label}</span>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Volver a la pregunta anterior
              </button>
            )}
          </motion.div>
        )}

        {/* Results */}
        {!isAnalyzing && step >= QUESTIONS.length && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full"
          >
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-6 ring-8 ring-green-50 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-4xl md:text-5xl font-serif font-black text-neutral-900 mb-6">
                Tus recomendaciones perfectas
              </h2>
              <div className="inline-flex flex-wrap justify-center gap-2 text-sm md:text-base text-neutral-600 font-medium bg-neutral-100 px-6 py-3 rounded-full border border-neutral-200">
                <span>🐶 {answers.edad}</span>
                <span className="text-neutral-300">•</span>
                <span>📏 {answers.tamano}</span>
                <span className="text-neutral-300">•</span>
                <span>🎯 {answers.objetivo}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 md:gap-8">
              {recommended.map((art, index) => (
                <motion.div 
                  key={art.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + (index * 0.1) }}
                  className="relative mt-6 lg:mt-0"
                >
                  <div className="absolute -top-5 -right-5 z-20 w-14 h-14 bg-gradient-to-tr from-amber-400 to-amber-300 text-amber-900 font-black rounded-full flex flex-col items-center justify-center shadow-xl border-4 border-white rotate-12">
                    <span className="text-[10px] leading-none uppercase tracking-wider mb-0.5 opacity-80">Top</span>
                    <span className="text-xl leading-none">#{index + 1}</span>
                  </div>
                  <div className={index === 0 ? "ring-4 ring-amber-400 rounded-2xl shadow-xl scale-105 transition-transform" : "h-full"}>
                    <ProductCard 
                      slug={art.slug}
                      nombre={art.data.nombre}
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

            <div className="mt-20 text-center">
              <button 
                onClick={() => { setStep(0); setAnswers({}); }}
                className="inline-flex items-center gap-2 text-neutral-500 font-bold hover:text-neutral-900 transition-colors bg-white border-2 border-neutral-200 px-6 py-3 rounded-xl hover:border-neutral-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Volver a hacer el test
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

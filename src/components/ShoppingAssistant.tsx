import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from './ProductCard';
import { 
  Baby, Dog, Activity, 
  Minimize2, Expand, Maximize2, 
  Bone, Map, Zap, Drumstick, 
  ArrowLeft, Sparkles, CheckCircle2, RotateCcw,
  Coins, Wallet, Gem
} from 'lucide-react';

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
    subtitle: 'Responde 4 preguntas rápidas y te recomendaremos los productos exactos para mejorar su calidad de vida.',
    options: [{ label: 'Empezar el test', value: 'start' }],
  },
  {
    id: 'edad',
    title: '¿Qué edad tiene tu perro?',
    subtitle: 'Las necesidades nutricionales y físicas cambian con la edad.',
    options: [
      { label: 'Cachorro', value: 'cachorro', icon: <Baby size={36} strokeWidth={1.5} className="text-blue-500" />, desc: 'Menos de 1 año' },
      { label: 'Adulto', value: 'adulto', icon: <Dog size={36} strokeWidth={1.5} className="text-amber-600" />, desc: 'De 1 a 7 años' },
      { label: 'Senior', value: 'senior', icon: <Activity size={36} strokeWidth={1.5} className="text-teal-600" />, desc: 'Más de 7 años' },
    ],
  },
  {
    id: 'tamano',
    title: '¿Cuál es su tamaño aproximado?',
    subtitle: 'Importante para elegir correas, camas o dosis de suplementos.',
    options: [
      { label: 'Pequeño', value: 'pequeno', icon: <Minimize2 size={36} strokeWidth={1.5} className="text-emerald-500" />, desc: 'Menos de 10 kg' },
      { label: 'Mediano', value: 'mediano', icon: <Expand size={36} strokeWidth={1.5} className="text-indigo-500" />, desc: 'De 10 a 25 kg' },
      { label: 'Grande', value: 'grande', icon: <Maximize2 size={36} strokeWidth={1.5} className="text-rose-500" />, desc: 'Más de 25 kg' },
    ],
  },
  {
    id: 'objetivo',
    title: '¿En qué área necesitas más ayuda hoy?',
    subtitle: 'Selecciona la principal preocupación o necesidad.',
    options: [
      { label: 'Descanso y Movilidad', value: 'movilidad', icon: <Bone size={36} strokeWidth={1.5} className="text-stone-500" />, desc: 'Camas, rampas, articulaciones' },
      { label: 'Paseo y Educación', value: 'paseo', icon: <Map size={36} strokeWidth={1.5} className="text-sky-500" />, desc: 'Tirones, bozales, collares' },
      { label: 'Ansiedad y Miedos', value: 'ansiedad', icon: <Zap size={36} strokeWidth={1.5} className="text-yellow-500" />, desc: 'Tormentas, separación, estrés' },
      { label: 'Alimentación y Digestión', value: 'alimentacion', icon: <Drumstick size={36} strokeWidth={1.5} className="text-orange-500" />, desc: 'Dietas especiales, suplementos' },
    ],
  },
  {
    id: 'presupuesto',
    title: '¿Cuánto tienes pensado invertir?',
    subtitle: 'Nos ayuda a recomendarte opciones dentro de tu rango de precios.',
    options: [
      { label: 'Económico', value: 'economico', icon: <Coins size={36} strokeWidth={1.5} className="text-gray-500" />, desc: 'Prioridad al mejor precio' },
      { label: 'Calidad-Precio', value: 'medio', icon: <Wallet size={36} strokeWidth={1.5} className="text-blue-500" />, desc: 'Opciones equilibradas' },
      { label: 'Premium', value: 'premium', icon: <Gem size={36} strokeWidth={1.5} className="text-purple-500" />, desc: 'La mejor calidad posible' },
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
    let scoredArticles = articulos.map(art => {
      let score = 0;
      const cat = art.data.categoria?.toLowerCase() || '';
      const name = art.data.nombre.toLowerCase();
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
              <div className="absolute inset-0 flex items-center justify-center text-primary-500">
                <Sparkles size={32} />
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

            <div className={`grid gap-5 w-full mx-auto ${step === 0 ? 'max-w-md grid-cols-1' : 'max-w-5xl grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
              {QUESTIONS[step].options.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => handleOptionClick(opt.value)}
                  className={`relative overflow-hidden group flex ${step === 0 ? 'justify-center items-center bg-navy-700 text-white p-6 md:p-8 rounded-2xl' : 'text-left flex-col bg-white p-4 md:p-5 rounded-xl'} border-2 ${step === 0 ? 'border-navy-700' : 'border-neutral-200'} hover:border-primary-500 hover:shadow-xl transition-all hover:-translate-y-1.5`}
                >
                  {step !== 0 && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  
                  <div className="relative z-10 w-full">
                    {opt.icon && <span className="mb-3 block drop-shadow-sm group-hover:scale-110 transition-transform origin-left">{opt.icon}</span>}
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

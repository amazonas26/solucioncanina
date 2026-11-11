import { slugify } from "./slugify";

type ProductLike = {
  data: {
    nombre: string;
    descripcion?: string;
    categoria?: string;
    marca?: string;
    secciones?: string[];
    seccionPrimaria?: string;
  };
};

export type ProblemSection = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  match: (product: ProductLike) => boolean;
  problema?: string;
  cuandoConviene?: string[];
  queMirar?: string[];
};

const includesAny = (text: string, words: string[]) =>
  words.some((word) => text.includes(word));

const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const textOf = (product: ProductLike) =>
  normalizeText(
    [product.data.nombre, product.data.descripcion, product.data.categoria, product.data.marca]
      .filter(Boolean)
      .join(" "),
  );

const categoryIs = (product: ProductLike, categories: string[]) =>
  product.data.categoria ? categories.includes(product.data.categoria) : false;

const seniorHints = [
  "senior",
  "mayores",
  "perro mayor",
  "perros mayor",
  "8 anos",
  "9 anos",
  "8+",
  "9+",
  "artrosis",
];

const section = (
  name: string,
  description: string,
  icon: string,
  match: (product: ProductLike) => boolean,
  extra?: { problema?: string; cuandoConviene?: string[]; queMirar?: string[] },
): ProblemSection => ({
  name,
  slug: slugify(name),
  description,
  icon,
  match,
  ...extra,
});

export const problemSections = [
  section(
    "Movilidad y artrosis",
    "Ayudas para perros con dolor articular, cadera delicada o movilidad reducida.",
    "joint",
    (product) => categoryIs(product, ["Condroprotectores", "Rampas"]),
    {
      problema:
        "El dolor articular casi nunca aparece de golpe. Empieza por pequeñas señales que la mayoría normaliza: el perro tarda más en levantarse, le cuesta saltar al coche, evita las escaleras, se sienta antes de tiempo en el paseo. Cuando se ve cojera ya hay un trasfondo de inflamación crónica que lleva meses. Por eso esta sección no es solo para perros mayores: en razas grandes y trabajadoras tiene sentido empezar a apoyar las articulaciones mucho antes, como prevención.",
      cuandoConviene: [
        "Razas grandes o gigantes con predisposición a displasia (Pastor Alemán, Labrador, Golden, Bóxer).",
        "Perros adultos con primeros signos de rigidez al despertar o tras actividad intensa.",
        "Tras una operación o lesión articular, como apoyo de fondo del tratamiento veterinario.",
      ],
      queMirar: [
        "Composición real (glucosamina, condroitina, MSM, mejillón de labio verde, omega-3 marino).",
        "Dosis adaptada al peso del perro, no genérica.",
        "Formato que tu perro acepte sin pelea — la adherencia diaria es lo que marca la diferencia.",
      ],
    },
  ),
  section(
    "Descanso ortopédico",
    "Camas y soportes para dormir mejor, recuperarse y aliviar puntos de presión.",
    "bed",
    (product) => categoryIs(product, ["Camas ortopédicas"]),
    {
      problema:
        "Un perro adulto pasa entre 12 y 16 horas al día tumbado. Esas horas, multiplicadas por una superficie inadecuada, son una factura silenciosa para la cadera, los codos y la columna. No hace falta esperar a tener un perro mayor para plantearse una cama ortopédica: en razas grandes, en perros operados, en cachorros que crecen rápido o en pisos con suelo duro, el descanso correcto previene problemas más que arreglarlos.",
      cuandoConviene: [
        "Perros de raza grande o de más de 25 kg, incluso jóvenes.",
        "Perros senior o con artrosis ya diagnosticada.",
        "Cualquier perro que duerma directamente sobre suelo duro o textil fino.",
      ],
      queMirar: [
        "Espuma de memoria (memory foam) con suficiente grosor para no tocar fondo con el peso del perro.",
        "Funda extraíble y lavable a máquina (la usarás más de lo que crees).",
        "Tamaño correcto: tu perro estirado tiene que caber con holgura, no enrollarse a la fuerza.",
      ],
    },
  ),
  section(
    "Problemas renales y urinarios",
    "Dietas veterinarias y productos para perros con necesidades renales o urinarias.",
    "kidney",
    (product) => {
      const text = textOf(product);
      return (
        product.data.categoria === "Alimentación específica" &&
        includesAny(text, ["renal", "urinari", "kidney", "oxalate"])
      );
    },
    {
      problema:
        "La insuficiencia renal crónica y las afecciones urinarias son uno de los diagnósticos más habituales en perros mayores, y también uno de los que mejor responden cuando se acompaña con una dieta veterinaria adecuada. No es marketing: hay décadas de evidencia de que reducir fósforo, ajustar proteínas y controlar minerales alarga la vida y mejora el bienestar del perro renal. Esta sección reúne las dietas más usadas en clínica, pero no sustituye la indicación de tu veterinario — al revés, son productos pensados para usarse con seguimiento.",
      cuandoConviene: [
        "Tras un diagnóstico de insuficiencia renal crónica o cálculos urinarios.",
        "En perros mayores con analíticas que empiezan a mostrar valores límite (urea, creatinina).",
        "Cuando el veterinario recomienda mantenimiento renal a largo plazo.",
      ],
      queMirar: [
        "Que sea una dieta veterinaria reconocida, no un pienso comercial 'light'.",
        "Si tu perro lo aceptará: muchas dietas renales tienen una palatabilidad complicada.",
        "Que el cambio se haga progresivo (10 días) para evitar rechazo.",
      ],
    },
  ),
  section(
    "Digestión sensible",
    "Opciones para perros con estómago delicado, digestiones difíciles o apoyo intestinal.",
    "bowl",
    (product) => {
      const text = textOf(product);
      return includesAny(text, ["gastro", "digest", "probiotic", "probiot", "intestinal"]);
    },
    {
      problema:
        "Las heces blandas recurrentes, los gases, las regurgitaciones o los episodios de gastroenteritis no siempre son un problema grave, pero sí merecen una mirada honesta. Muchas veces hay detrás una microbiota desequilibrada, una intolerancia alimentaria sin identificar o un cambio de pienso mal gestionado. Antes de probar suplementos conviene descartar parásitos y revisar la dieta base; después, un apoyo digestivo de fondo (probióticos, fibras solubles, dieta gastrointestinal) puede estabilizar la situación durante semanas o meses.",
      cuandoConviene: [
        "Heces blandas frecuentes sin causa aguda evidente.",
        "Tras un tratamiento con antibióticos que ha alterado la flora intestinal.",
        "En perros con tendencia a regurgitar o vomitar bilis por la mañana.",
      ],
      queMirar: [
        "Que el probiótico declare cepas concretas y UFC vivas, no 'fermentos genéricos'.",
        "Que la dieta sea de fácil digestión y, si es necesario, hipoalergénica.",
        "Si los síntomas pasan de 3-4 semanas, consulta veterinaria antes de seguir probando.",
      ],
    },
  ),
  section(
    "Ansiedad y estrés",
    "Feromonas, calmantes y apoyo para ruidos, separación, viajes o cambios de rutina.",
    "calm",
    (product) => product.data.categoria === "Ansiedad",
    {
      problema:
        "La ansiedad en perros casi nunca es 'ser nervioso'. Es un sistema de alarma que se queda encendido más tiempo del que debería, ante ausencias, ruidos, cambios o sin un detonante claro. Antes de mirar productos conviene entender de qué tipo de ansiedad hablamos, porque la respuesta a cada una es distinta: la separación se trabaja con protocolo de ausencias progresivas, los petardos con desensibilización y refugio, los viajes con familiarización al transportín. Los productos de esta sección son apoyos del trabajo de conducta, no atajos.",
      cuandoConviene: [
        "Cuando los síntomas (jadeo, destrozos, ladridos al timbre, miedo a petardos) interfieren con el día a día.",
        "Cuando llevas semanas trabajando conducta y necesitas un apoyo de fondo.",
        "Cuando entran temporadas críticas (verbenas, fin de año, mudanzas, obras).",
      ],
      queMirar: [
        "Si es uso puntual (eventos) o de fondo (mantenimiento prolongado).",
        "Si el principio activo está documentado (feromonas, L-triptófano, manzanilla, fitoterapia conocida).",
        "Si encaja con el peso y tamaño de tu perro — la dosis cuenta.",
      ],
    },
  ),
  section(
    "Perros senior",
    "Productos útiles para perros mayores: articulaciones, descanso, rampas y dietas específicas.",
    "senior",
    (product) =>
      categoryIs(product, ["Condroprotectores", "Rampas", "Camas ortopédicas"]) ||
      includesAny(textOf(product), seniorHints),
    {
      problema:
        "Un perro senior no necesita 'compasión', necesita ajustes. A partir de los 7-8 años en razas grandes (algo más tarde en pequeñas) cambia el patrón de actividad, la calidad del sueño, las exigencias articulares y, a menudo, el apetito y la digestión. La mayoría de cosas que mejoran su vida son mecánicas: una buena cama, una rampa para no saltar del coche, un suplemento articular constante, una dieta ajustada al gasto real. Nada espectacular, todo acumulativo.",
      cuandoConviene: [
        "Cuando empiezas a notar que tarda más en levantarse o se queda atrás en los paseos.",
        "Tras la primera analítica senior con valores límite (función renal, hepática, tiroides).",
        "Como revisión preventiva anual a partir de los 7-8 años.",
      ],
      queMirar: [
        "Suplementos con dosis efectiva, no 'multi-todo' diluidos.",
        "Camas con grosor suficiente para repartir el peso sin tocar fondo.",
        "Rampas estables, antideslizantes, con inclinación suave.",
      ],
    },
  ),
  section(
    "Paseos seguros y control",
    "Correas, arneses y bozales para paseos más tranquilos, seguros y controlados.",
    "lead",
    (product) => categoryIs(product, ["Correas", "Bozales"]),
    {
      problema:
        "El paseo no debería ser una pelea. Si tu perro tira, se cruza con otros perros con tensión, o tienes que usar bozal por seguridad en transporte público o en la consulta del veterinario, el material que uses cambia totalmente la experiencia. Un arnés bien ajustado evita daños cervicales; una correa larga abre la puerta al trabajo de llamada y al olfato libre; un bozal de cesta correctamente medido permite jadear y beber sin restringir la respiración. Aquí prima la elección por funcionalidad real, no por estética.",
      cuandoConviene: [
        "Perros que tiran y necesitas trabajar el paseo sin dañar el cuello.",
        "Perros reactivos o que necesitan bozal por contexto (visitas al veterinario, transporte público).",
        "Trabajo de obediencia y llamada en distancia (correa larga 5-10 m).",
      ],
      queMirar: [
        "Arnés con apoyo en pecho y espalda, sin rozar las axilas.",
        "Bozal de cesta (no de tela cerrada) si el uso es de más de unos minutos.",
        "Correa larga de material que no queme al pasar entre los dedos en una carrera del perro.",
      ],
    },
  ),
  section(
    "Subir al coche o sofá",
    "Rampas y escaleras para reducir saltos y proteger espalda, cadera y articulaciones.",
    "ramp",
    (product) => product.data.categoria === "Rampas",
    {
      problema:
        "Cada salto desde el maletero o el sofá impacta sobre la columna y las articulaciones del perro con fuerzas que pueden multiplicar varias veces su peso. En razas con espalda larga (Teckel, Bulldog Francés, Corgi), en perros grandes con tendencia a displasia, o en perros mayores con artrosis, las rampas no son una excentricidad: son prevención básica. Lo curioso es que la mayoría de la gente se las plantea cuando ya hay un problema diagnosticado, no antes — y en este caso, antes es mucho más útil.",
      cuandoConviene: [
        "Perros con columna larga (Teckel, Corgi, Basset, Bulldog Francés).",
        "Perros mayores que evitan saltar al coche o tardan en hacerlo.",
        "Tras una operación de columna, cadera o rodilla.",
      ],
      queMirar: [
        "Superficie antideslizante real, no pintura imitación.",
        "Inclinación suave: si la rampa es muy vertical, el perro no la usará.",
        "Peso máximo y plegado: si pesa 20 kg y no se pliega, acabará en el trastero.",
      ],
    },
  ),
];

/** Usa `secciones` del JSON si existe; si no, aplica reglas automáticas (legacy). */
export function productInSection(product: ProductLike, section: ProblemSection): boolean {
  const stored = product.data.secciones;
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.includes(section.name);
  }
  return section.match(product);
}

/**
 * Para la HOME y para las páginas de sección por problema: si el producto define
 * `seccionPrimaria` (slug), solo se considera "perteneciente" a esa sección.
 * En caso contrario, se aplica la regla por `secciones`/`match` para mantener
 * compatibilidad con el catálogo existente.
 */
export function productInPrimarySection(
  product: ProductLike,
  section: ProblemSection,
): boolean {
  const primary = product.data.seccionPrimaria;
  if (typeof primary === "string" && primary.length > 0) {
    return primary === section.slug;
  }
  return productInSection(product, section);
}

export function countProductsInSection(
  products: ProductLike[],
  section: ProblemSection,
): number {
  return products.filter((product) => productInPrimarySection(product, section)).length;
}

type CategoryGuide = {
  problema: string;
  cuandoConviene: string[];
  queMirar: string[];
};

const categoryGuides: Record<string, CategoryGuide> = {
  "Camas ortopédicas": {
    problema:
      "La cama es el mueble que más usa tu perro y, paradójicamente, al que menos atención solemos dar. Una cama ortopédica de calidad reparte el peso, reduce puntos de presión y permite un sueño más profundo, algo que se nota especialmente en razas grandes, perros mayores o tras una operación. No es lujo: es una de las inversiones con mejor retorno a medio plazo en confort y prevención articular.",
    cuandoConviene: [
      "Razas grandes o gigantes, incluso jóvenes y sanos.",
      "Perros senior o con artrosis diagnosticada.",
      "Perros recién operados que necesitan descanso de calidad para recuperarse.",
    ],
    queMirar: [
      "Grosor real de espuma (mínimo 8-10 cm en perros grandes).",
      "Funda lavable a máquina y desenfundable de verdad.",
      "Tamaño suficiente para que el perro estire las patas sin tocar bordes.",
    ],
  },
  "Condroprotectores": {
    problema:
      "Los condroprotectores no curan la artrosis, pero ralentizan su avance y reducen las molestias del día a día. Funcionan mejor cuanto antes se introducen: en razas con tendencia a displasia, lo razonable es empezar a partir de los 4-5 años, sin esperar a la primera cojera. En perros con artrosis avanzada, son un complemento del tratamiento veterinario, no un sustituto.",
    cuandoConviene: [
      "Razas grandes con predisposición a problemas articulares.",
      "Perros con primeros signos de rigidez o lentitud al levantarse.",
      "Perros senior, como apoyo de fondo durante años.",
    ],
    queMirar: [
      "Ingredientes con evidencia: glucosamina, condroitina, MSM, mejillón de labio verde.",
      "Dosis ajustada al peso real del perro.",
      "Formato (comprimido, snack, líquido) que tu perro acepte sin pelea diaria.",
    ],
  },
  "Rampas": {
    problema:
      "Las rampas resuelven un problema concreto: evitar el impacto de saltos repetidos sobre la columna y las articulaciones. Tienen sentido en razas con espalda larga, en perros grandes con cadera delicada y en perros mayores que ya rechazan saltar al coche. La diferencia entre una rampa que se usa cada día y una que acaba en el trastero está en el ángulo, el agarre y el peso a la hora de plegarla.",
    cuandoConviene: [
      "Acceder al maletero del coche sin saltar.",
      "Subir al sofá o cama en razas con columna larga.",
      "Tras una intervención de columna, cadera o rodilla.",
    ],
    queMirar: [
      "Superficie antideslizante real, no impresión decorativa.",
      "Inclinación suave (mejor más larga que vertical).",
      "Peso de la propia rampa: si pesa demasiado, no la sacarás.",
    ],
  },
  "Correas": {
    problema:
      "La correa no es solo un accesorio: es la primera herramienta de comunicación entre tú y tu perro en el paseo. Una correa demasiado corta o demasiado rígida limita el olfato; una extensible mal usada enseña a tirar; una larga de adiestramiento, bien gestionada, cambia totalmente la relación con el perro. El material adecuado depende del peso del perro, del tipo de paseo y del trabajo que quieras hacer.",
    cuandoConviene: [
      "Paseo urbano de control (correa de 1,2-2 m).",
      "Trabajo de llamada y olfato libre (correa larga de 5-10 m).",
      "Adiestramiento en distancia (línea larga ligera).",
    ],
    queMirar: [
      "Mosquetón resistente y bien cosido al material.",
      "Tacto que no queme al deslizarse entre los dedos en un tirón.",
      "Reflectantes si paseas a primera hora o de noche.",
    ],
  },
  "Bozales": {
    problema:
      "El bozal todavía arrastra estigma, pero en muchos contextos es la herramienta más responsable: visitas al veterinario en perros doloridos, transporte público obligatorio en razas concretas, paseos en perros reactivos durante el trabajo de conducta, o entornos donde hay basura peligrosa en el suelo. La clave es que sea un bozal de cesta correctamente medido: tiene que permitir jadear, beber y aceptar premios. Los bozales de tela cerrada solo sirven para usos muy puntuales y nunca de forma prolongada.",
    cuandoConviene: [
      "Razas catalogadas como PPP (obligación legal en transporte público).",
      "Perros reactivos durante el trabajo de desensibilización.",
      "Visitas al veterinario en perros con dolor o miedo.",
    ],
    queMirar: [
      "Tipo cesta, no tela cerrada, si el uso pasa de unos minutos.",
      "Talla bien medida: holgura para jadear, sin que se salga.",
      "Material que no irrite la piel en uso prolongado.",
    ],
  },
  "Ansiedad": {
    problema:
      "La ansiedad no se 'medica y ya'. Es un cuadro complejo que casi siempre requiere trabajo de conducta como base, y apoyos puntuales o de fondo según la intensidad. En esta sección encontrarás los apoyos más usados: feromonas en difusor para crear ambiente, snacks calmantes para situaciones puntuales, suplementos de fondo para etapas largas. Todos son complementos, no sustitutos, del protocolo de desensibilización adecuado.",
    cuandoConviene: [
      "Etapas de adaptación (mudanza, llegada de un bebé, cambio de rutina).",
      "Eventos puntuales con ruido (verbenas, fin de año, tormentas).",
      "Trabajo prolongado de ansiedad por separación o miedos diversos.",
    ],
    queMirar: [
      "Principio activo documentado (feromonas, L-triptófano, manzanilla, melisa).",
      "Formato adecuado al uso (difusor, snack, comprimido, líquido).",
      "Dosificación clara según peso del perro.",
    ],
  },
  "Alimentación específica": {
    problema:
      "Las dietas veterinarias específicas no son piensos comerciales 'premium': son alimentos diseñados para una patología concreta (renal, urinaria, gastrointestinal, hepática, articular) y se prescriben tras un diagnóstico. Aquí no se trata de elegir 'el mejor pienso del año', sino de elegir el que corresponde al cuadro clínico del perro y mantenerlo a largo plazo con el seguimiento del veterinario.",
    cuandoConviene: [
      "Tras un diagnóstico veterinario que indique dieta específica.",
      "Como mantenimiento prolongado de una patología crónica.",
      "Para evitar recaídas en perros con historial recurrente del mismo cuadro.",
    ],
    queMirar: [
      "Que sea una marca veterinaria reconocida y respaldada por tu veterinario.",
      "Aceptación de tu perro: muchas dietas específicas son menos palatables.",
      "Transición progresiva (7-10 días) al introducir la dieta nueva.",
    ],
  },
};

export function getCategoryGuide(category: string): CategoryGuide | null {
  return categoryGuides[category] ?? null;
}

// SEO específic per categoria: títol i meta-description orientats a la query real
// ("<keyword> para perros", intenció comercial/comparativa) en lloc del nom curt.
// El títol NO inclou la marca: SEO.astro hi afegeix " | Solución Canina".
// L'H1 visible segueix sent el nom curt de la categoria (decoblat del <title>).
type CategorySeo = { title: string; description: string };

const categorySeo: Record<string, CategorySeo> = {
  "Condroprotectores": {
    title: "Condroprotectores para perros: comparativa y precios",
    description:
      "Comparativa de condroprotectores para perros: glucosamina, condroitina, MSM y mejillón de labio verde. Qué lleva cada uno, para qué perro y análisis honesto.",
  },
  "Camas ortopédicas": {
    title: "Camas ortopédicas para perros: comparativa y precios",
    description:
      "Camas ortopédicas para perros: viscoelástica, impermeable y desenfundable. Tamaño y grosor de espuma según el peso de tu perro para elegir la mejor.",
  },
  "Correas": {
    title: "Correas para perros: largas, adiestramiento y paseo",
    description:
      "Correas para perros: largas de adiestramiento, de paseo y antitirones. Materiales, longitudes y precios comparados con análisis propio.",
  },
  "Alimentación específica": {
    title: "Pienso y dietas veterinarias para perros",
    description:
      "Piensos y dietas veterinarias para perros: renal, urinario, gastrointestinal y articular. Comparativa de marcas y precios con criterio.",
  },
  "Bozales": {
    title: "Bozales para perros: cesta, silicona y a medida",
    description:
      "Bozales para perros de cesta, silicona y a medida. Cómo elegir la talla para que pueda jadear, beber y aceptar premios. Comparativa y precios.",
  },
  "Ansiedad": {
    title: "Calmantes y antiestrés para perros con ansiedad",
    description:
      "Calmantes y antiestrés para perros: feromonas, snacks y suplementos naturales. Qué funciona para ruidos, separación y viajes. Comparativa honesta.",
  },
  "Rampas": {
    title: "Rampas para perros: coche, sofá y cama",
    description:
      "Rampas para perros para coche, sofá y cama. Plegables y antideslizantes, por peso y altura. Comparativa de modelos y precios con análisis propio.",
  },
};

export function getCategorySeo(category: string): CategorySeo | null {
  return categorySeo[category] ?? null;
}

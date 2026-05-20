import { slugify } from "./slugify";

type ProductLike = {
  data: {
    nombre: string;
    descripcion?: string;
    categoria?: string;
    marca?: string;
    secciones?: string[];
  };
};

export type ProblemSection = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  match: (product: ProductLike) => boolean;
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
): ProblemSection => ({
  name,
  slug: slugify(name),
  description,
  icon,
  match,
});

export const problemSections = [
  section(
    "Movilidad y artrosis",
    "Ayudas para perros con dolor articular, cadera delicada o movilidad reducida.",
    "joint",
    (product) => categoryIs(product, ["Condroprotectores", "Rampas"]),
  ),
  section(
    "Descanso ortopédico",
    "Camas y soportes para dormir mejor, recuperarse y aliviar puntos de presión.",
    "bed",
    (product) => categoryIs(product, ["Camas ortopédicas"]),
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
  ),
  section(
    "Digestión sensible",
    "Opciones para perros con estómago delicado, digestiones difíciles o apoyo intestinal.",
    "bowl",
    (product) => {
      const text = textOf(product);
      return includesAny(text, ["gastro", "digest", "probiotic", "probiot", "intestinal"]);
    },
  ),
  section(
    "Ansiedad y estrés",
    "Feromonas, calmantes y apoyo para ruidos, separación, viajes o cambios de rutina.",
    "calm",
    (product) => product.data.categoria === "Ansiedad",
  ),
  section(
    "Perros senior",
    "Productos útiles para perros mayores: articulaciones, descanso, rampas y dietas específicas.",
    "senior",
    (product) =>
      categoryIs(product, ["Condroprotectores", "Rampas", "Camas ortopédicas"]) ||
      includesAny(textOf(product), seniorHints),
  ),
  section(
    "Paseos seguros y control",
    "Correas, arneses y bozales para paseos más tranquilos, seguros y controlados.",
    "lead",
    (product) => categoryIs(product, ["Correas", "Bozales"]),
  ),
  section(
    "Subir al coche o sofá",
    "Rampas y escaleras para reducir saltos y proteger espalda, cadera y articulaciones.",
    "ramp",
    (product) => product.data.categoria === "Rampas",
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

export function countProductsInSection(
  products: ProductLike[],
  section: ProblemSection,
): number {
  return products.filter((product) => productInSection(product, section)).length;
}

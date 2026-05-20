"""Reglas compartidas para asignar secciones por necesidad a productos del catálogo.

Las secciones son distintas de `categoria` (tipo de producto). Un producto
puede pertenecer a varias secciones (p. ej. rampa → movilidad + subir al coche).

Usado por:
  - scripts/update_secciones.py
  - scripts/find_new_products.py (al crear fichas nuevas)
"""

from __future__ import annotations

import re
import unicodedata
from typing import Callable

from _common import slugify

ProductData = dict[str, object]
Matcher = Callable[[ProductData], bool]


def _normalize(text: str) -> str:
    s = unicodedata.normalize("NFD", text)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower()


def _text_of(data: ProductData) -> str:
    parts = [
        str(data.get("nombre") or ""),
        str(data.get("descripcion") or ""),
        str(data.get("categoria") or ""),
        str(data.get("marca") or ""),
    ]
    return _normalize(" ".join(p for p in parts if p))


def _category_is(data: ProductData, categories: list[str]) -> bool:
    cat = data.get("categoria")
    return isinstance(cat, str) and cat in categories


def _includes_any(text: str, words: list[str]) -> bool:
    return any(word in text for word in words)


# Palabras amb «mayor» en descripcions de marketing («mayor comodidad», «mayor durabilidad»).
_SENIOR_HINTS = [
    "senior",
    "mayores",
    "perro mayor",
    "perros mayor",
    "8 anos",
    "9 anos",
    "8+",
    "9+",
    "artrosis",
]


def _section(name: str, description: str, icon: str, match: Matcher) -> dict:
    return {
        "name": name,
        "slug": slugify(name),
        "description": description,
        "icon": icon,
        "match": match,
    }


PROBLEM_SECTIONS: list[dict] = [
    _section(
        "Movilidad y artrosis",
        "Ayudas para perros con dolor articular, cadera delicada o movilidad reducida.",
        "joint",
        lambda d: _category_is(d, ["Condroprotectores", "Rampas"]),
    ),
    _section(
        "Descanso ortopédico",
        "Camas y soportes para dormir mejor, recuperarse y aliviar puntos de presión.",
        "bed",
        lambda d: _category_is(d, ["Camas ortopédicas"]),
    ),
    _section(
        "Problemas renales y urinarios",
        "Dietas veterinarias y productos para perros con necesidades renales o urinarias.",
        "kidney",
        lambda d: (
            d.get("categoria") == "Alimentación específica"
            and _includes_any(
                _text_of(d),
                ["renal", "urinari", "kidney", "oxalate"],
            )
        ),
    ),
    _section(
        "Digestión sensible",
        "Opciones para perros con estómago delicado, digestiones difíciles o apoyo intestinal.",
        "bowl",
        lambda d: _includes_any(
            _text_of(d),
            ["gastro", "digest", "probiotic", "probiot", "intestinal"],
        ),
    ),
    _section(
        "Ansiedad y estrés",
        "Feromonas, calmantes y apoyo para ruidos, separación, viajes o cambios de rutina.",
        "calm",
        # Solo productos de la categoría Ansiedad (evita camas/bozales con «estrés» en la descripción).
        lambda d: d.get("categoria") == "Ansiedad",
    ),
    _section(
        "Perros senior",
        "Productos útiles para perros mayores: articulaciones, descanso, rampas y dietas específicas.",
        "senior",
        lambda d: (
            _category_is(d, ["Condroprotectores", "Rampas", "Camas ortopédicas"])
            or _includes_any(_text_of(d), _SENIOR_HINTS)
        ),
    ),
    _section(
        "Paseos seguros y control",
        "Correas, arneses y bozales para paseos más tranquilos, seguros y controlados.",
        "lead",
        # Solo correas y bozales (evita rampas con «correas para transporte» en el título).
        lambda d: _category_is(d, ["Correas", "Bozales"]),
    ),
    _section(
        "Subir al coche o sofá",
        "Rampas y escaleras para reducir saltos y proteger espalda, cadera y articulaciones.",
        "ramp",
        # Solo rampas/escaleras (evita camas «sofá» o suplementos que mencionen subir al coche).
        lambda d: d.get("categoria") == "Rampas",
    ),
]

SECTION_NAMES: list[str] = [s["name"] for s in PROBLEM_SECTIONS]
SECTION_BY_SLUG: dict[str, dict] = {s["slug"]: s for s in PROBLEM_SECTIONS}


def compute_secciones(data: ProductData) -> list[str]:
    """Devuelve los nombres de sección que aplican a este producto."""
    return [s["name"] for s in PROBLEM_SECTIONS if s["match"](data)]


# Categorías de producto soportadas por find_new_products (claves = campo categoria).
CATALOG_CATEGORIES: dict[str, list[str]] = {
    "Rampas": [
        "rampa perro plegable coche",
        "rampa perro grande maletero",
    ],
    "Ansiedad": [
        "antiestres perro feromonas",
        "calmante perro ansiedad masticables",
    ],
    "Camas ortopédicas": [
        "cama ortopedica perro grande",
        "cama viscoelastica perro",
    ],
    "Alimentación específica": [
        "pienso veterinario perro renal",
        "pienso prescripcion perro digestivo",
    ],
    "Condroprotectores": [
        "condroprotector perro glucosamina",
        "suplemento articulaciones perro senior",
        "aceite salmon perro omega 3",
    ],
    "Correas": [
        "correa perro adiestramiento larga",
        "correa canicross perro",
    ],
    "Bozales": [
        "bozal perro silicona cesta",
        "bozal perro grande",
    ],
}

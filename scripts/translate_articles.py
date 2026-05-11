import os
import json
import re

# Mapping for categories
category_map = {
    "Ansietat": "Ansiedad",
    "Bozal": "Bozales",
    "Correes": "Correas",
    "Gossos sènior": "Perros senior",
    "Llits ortopèdics": "Camas ortopédicas",
    "Menjar específic": "Alimentación específica",
    "Rampes": "Rampas",
    "Suplements": "Suplementos"
}

# Common Catalan to Spanish word replacements for titles/descriptions
word_map = {
    r'\bProbiòtics\b': 'Probióticos',
    r'\bprobiòtics\b': 'probióticos',
    r'\bPlàstic\b': 'Plástico',
    r'\bplàstic\b': 'plástico',
    r'\banys\b': 'años',
    r'\bsuau\b': 'suave',
    r'\bSuau\b': 'Suave',
    r'\breflectant\b': 'reflectante',
    r'\bReflectant\b': 'Reflectante',
    r'\badiestrament\b': 'adiestramiento',
    r'\bAdiestrament\b': 'Adiestramiento',
    r'\barticulacions\b': 'articulaciones',
    r'\bArticulacions\b': 'Articulaciones',
    r'\bhumit\b': 'húmedo',
    r'\bhumeda\b': 'húmeda',
    r'\bHúmeda\b': 'Húmeda',
    r'\bpeces\b': 'piezas',
    r'\bPeces\b': 'Piezas',
    r'\bposicions\b': 'posiciones',
    r'\bPosicions\b': 'Posiciones',
    r'\brastreig\b': 'rastreo',
    r'\bRastreig\b': 'Rastreo',
    r'\bdigestius\b': 'digestivos',
    r'\bDigestius\b': 'Digestivos',
    r'\bmultivitamines\b': 'multivitaminas',
    r'\bMultivitamines\b': 'Multivitaminas',
    r'\balumini\b': 'aluminio',
    r'\bAlumini\b': 'Aluminio',
    r'\banticòlics\b': 'anticólicos',
    r'\bcanasto\b': 'canasta',
    r'\bCanasto\b': 'Canasta',
    r'\bllac\b': 'lazo',
    r'\bLlaç\b': 'Lazo',
    r'\bcomprimits\b': 'comprimidos',
    r'\bComprimits\b': 'Comprimidos',
    r'\bEscocès\b': 'Escocés',
    r'\bescocès\b': 'escocés',
    r'\bAntiestrès\b': 'Antiestrés',
    r'\bantiestrès\b': 'antiestrés',
    r'\bArnès\b': 'Arnés',
    r'\barnès\b': 'arnés',
    r'\bprofessional\b': 'profesional',
    r'\bmaneig\b': 'manejo',
    r'\bergonòmic\b': 'ergonómico',
    r'\bpressiona\b': 'presiona',
    r'\bcoll\b': 'cuello',
    r'\bTelescòpica\b': 'Telescópica',
    r'\btelescòpica\b': 'telescópica',
    r'\bentrenament\b': 'entrenamiento',
    r'\bEntrenament\b': 'Entrenamiento',
    r'\bdorsal\b': 'dorsal', # Same
    r'\blateral\b': 'lateral', # Same
    r'\bperros\b': 'perros', # Same
    r'\bde\b': 'de', # Same
}

base_dir = "src/content/articulos"

for entry in os.listdir(base_dir):
    dir_path = os.path.join(base_dir, entry)
    if os.path.isdir(dir_path):
        json_file = os.path.join(dir_path, "index.json")
        if os.path.exists(json_file):
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Translate category
            old_cat = data.get("categoria")
            if old_cat in category_map:
                data["categoria"] = category_map[old_cat]
            
            # Translate name and description
            for field in ["nombre", "descripcion"]:
                if field in data and data[field]:
                    text = data[field]
                    for pattern, replacement in word_map.items():
                        text = re.sub(pattern, replacement, text)
                    data[field] = text
            
            # Save back
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

print("Translation complete!")

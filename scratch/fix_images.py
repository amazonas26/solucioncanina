import os
import json

base_path = 'src/content/articulos'
public_path = 'public'

unsplash_map = {
    'Camas': 'https://images.unsplash.com/photo-1591160611029-195973399f6b?q=80&w=800&auto=format&fit=crop',
    'Rampas': 'https://images.unsplash.com/photo-1591768575198-88dac53fbd0a?q=80&w=800&auto=format&fit=crop',
    'Salud': 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=800&auto=format&fit=crop',
    'Alimentación': 'https://images.unsplash.com/photo-1589924691106-073b19f553ca?q=80&w=800&auto=format&fit=crop',
    'Paseo': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop',
    'Higiene': 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=800&auto=format&fit=crop',
    'Default': 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=800&auto=format&fit=crop'
}

# More specific search for categories based on product name if category is missing
def get_unsplash_image(name, category):
    name_low = name.lower()
    if 'cama' in name_low or 'bed' in name_low:
        return unsplash_map['Camas']
    if 'rampa' in name_low or 'ramp' in name_low:
        return unsplash_map['Rampas']
    if 'condroprotector' in name_low or 'articulaciones' in name_low or 'joint' in name_low:
        return unsplash_map['Salud']
    if 'pienso' in name_low or 'renal' in name_low or 'comida' in name_low or 'salmon' in name_low:
        return unsplash_map['Alimentación']
    if 'correa' in name_low or 'lead' in name_low or 'arnes' in name_low or 'harness' in name_low:
        return unsplash_map['Paseo']
    if 'bozal' in name_low or 'muzzle' in name_low:
        return unsplash_map['Higiene']
    
    return unsplash_map.get(category, unsplash_map['Default'])

for root, dirs, files in os.walk(base_path):
    if 'index.json' in files:
        file_path = os.path.join(root, 'index.json')
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except:
                continue
        
        img_path = data.get('imagen', '')
        # Check if local image exists
        exists = False
        if img_path.startswith('/'):
            full_img_path = os.path.join(public_path, img_path.lstrip('/'))
            if os.path.exists(full_img_path) and 'placeholder.jpg' not in img_path:
                exists = True
        elif img_path.startswith('http'):
            exists = True
            
        if not exists:
            new_img = get_unsplash_image(data.get('nombre', ''), data.get('categoria', ''))
            print(f"Updating {data.get('nombre')} -> {new_img}")
            data['imagen'] = new_img
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

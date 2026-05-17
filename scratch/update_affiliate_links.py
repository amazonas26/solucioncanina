#!/usr/bin/env python3
import os
import json
import re
import argparse

def get_clean_amazon_url(url, tag):
    """
    Extrae el ASIN de la URL de Amazon y genera un enlace afiliado limpio y canónico:
    https://www.amazon.es/dp/{ASIN}/?tag={tag}
    """
    # Patrón común: /dp/ASIN o /gp/product/ASIN
    asin_match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', url, re.IGNORECASE)
    if not asin_match:
        # Patrón alternativo: buscar cualquier bloque de 10 caracteres alfanuméricos que empiece por B o número
        asin_match = re.search(r'/([B0-9][A-Z0-9]{9})(?:[/?]|$)', url, re.IGNORECASE)
    
    if asin_match:
        asin = asin_match.group(1).upper()
        return f"https://www.amazon.es/dp/{asin}/?tag={tag}"
    else:
        # Fallback en caso de URL no estándar: reemplazar o añadir el tag
        if "tag=" in url:
            cleaned_url = re.sub(r'tag=[^&]+', f'tag={tag}', url)
            return cleaned_url
        else:
            separator = "&" if "?" in url else "?"
            return f"{url}{separator}tag={tag}"

def update_catalog(tag, dry_run=False):
    articulos_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/content/articulos'))
    print(f"Buscando productos en: {articulos_dir}")
    
    if not os.path.exists(articulos_dir):
        print(f"Error: No se encontró la ruta {articulos_dir}")
        return

    updated_count = 0
    category_count = 0
    
    for root, dirs, files in os.walk(articulos_dir):
        for file in files:
            if file == "index.json":
                file_path = os.path.join(root, file)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    original_url = data.get('linkAmazon', '')
                    original_category = data.get('categoria', '')
                    
                    changed = False
                    
                    # 1. Actualizar URL de Amazon
                    if original_url:
                        new_url = get_clean_amazon_url(original_url, tag)
                        if new_url != original_url:
                            data['linkAmazon'] = new_url
                            changed = True
                            updated_count += 1
                            print(f"[{data.get('marca', 'Producto')}] URL limpia: {original_url} -> {new_url}")
                    
                    # 2. Actualizar categorías para optimización SEO en España
                    # "Perros senior" o "Suplementos" -> "Condroprotectores"
                    if original_category in ["Perros senior", "Suplementos"]:
                        data['categoria'] = "Condroprotectores"
                        changed = True
                        category_count += 1
                        print(f"[{data.get('nombre')[:30]}...] Categoría optimizada: {original_category} -> Condroprotectores")
                    
                    # Guardar cambios
                    if changed and not dry_run:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                            f.write('\n') # Asegurar salto de línea al final
                            
                except Exception as e:
                    print(f"Error procesando {file_path}: {e}")

    print("\n--- RESUMEN ---")
    print(f"Enlaces de afiliados actualizados: {updated_count}")
    print(f"Categorías de productos optimizadas SEO: {category_count}")
    if dry_run:
        print("MODO DE PRUEBA ACTIVO (No se guardó ningún cambio en el disco)")
    else:
        print("Cambios guardados correctamente en la base de datos local.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script para actualizar enlaces de afiliados de Amazon y optimizar categorías.")
    parser.add_argument("--tag", required=True, help="Tu ID de Afiliado de Amazon (ej. solucioncanin-21)")
    parser.add_argument("--dry-run", action="store_true", help="Ejecutar sin guardar cambios")
    
    args = parser.parse_args()
    update_catalog(args.tag, args.dry_run)

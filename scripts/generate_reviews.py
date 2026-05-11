import os
import json
import requests
import time

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3" # Puedes cambiar esto a "mistral" u otro modelo que tengas en Ollama

PROMPT_TEMPLATE = """
Actúa como un experto en cuidado canino y editor jefe de la revista 'Solución Canina'.
Tu objetivo es escribir una reseña editorial detallada y profesional para el siguiente producto: {nombre}.

La descripción base es: {descripcion}.

Por favor, genera el siguiente contenido en un tono profesional, experto y confiable (estilo BestReviews o Wirecutter):

1. Veredicto Editorial (2 frases): Un resumen potente de por qué este producto destaca y si vale la pena la compra.
2. Análisis en profundidad (2-3 párrafos): Explica los beneficios reales para el perro (salud, comodidad, seguridad) y menciona detalles técnicos de forma que se entiendan fácil.
3. Pros y Contras: Al menos 3 puntos positivos y 2 negativos (o limitaciones) para ser honestos con el lector.
4. ¿Para quién es este producto?: Define el tipo de perro o dueño ideal para este artículo.

IMPORTANTE: DEBES RESPONDER ÚNICAMENTE CON UN OBJETO JSON VÁLIDO QUE TENGA LA SIGUIENTE ESTRUCTURA ESTRICTA. NO AÑADAS TEXTO ANTES NI DESPUÉS DEL JSON:

{{
  "veredicto": "texto aquí",
  "analisis": "texto aquí",
  "pros": ["pro 1", "pro 2", "pro 3"],
  "contras": ["contra 1", "contra 2"],
  "paraQuien": "texto aquí"
}}
"""

def generate_review(nombre, descripcion):
    prompt = PROMPT_TEMPLATE.format(nombre=nombre, descripcion=descripcion)
    
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "format": "json",  # Force JSON output if supported by the model
        "stream": False
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        result = data.get('response', '')
        # Parse JSON
        return json.loads(result)
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: No se puede conectar a Ollama. Asegúrate de que está en ejecución (http://localhost:11434).")
        exit(1)
    except json.JSONDecodeError:
        print("❌ ERROR: El modelo no devolvió un JSON válido. Inténtalo de nuevo.")
        print("Respuesta cruda:", result)
        return None
    except Exception as e:
        print(f"Error generando review para {nombre}: {e}")
        return None

base_dir = "src/content/articulos"
count = 0

print("Iniciando generación de reseñas con Ollama...")

for entry in os.listdir(base_dir):
    dir_path = os.path.join(base_dir, entry)
    if os.path.isdir(dir_path):
        json_file = os.path.join(dir_path, "index.json")
        if os.path.exists(json_file):
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Si ya tiene veredicto, lo saltamos
            if "veredicto" in data and data["veredicto"]:
                print(f"[{entry}] ya tiene reseña. Saltando...")
                continue
            
            nombre = data.get("nombre", "")
            descripcion = data.get("descripcion", "")
            
            print(f"[{entry}] Generando reseña con Ollama ({MODEL_NAME})...")
            start = time.time()
            review_data = generate_review(nombre, descripcion)
            
            if review_data:
                data["veredicto"] = review_data.get("veredicto", "")
                data["analisis"] = review_data.get("analisis", "")
                data["pros"] = review_data.get("pros", [])
                data["contras"] = review_data.get("contras", [])
                data["paraQuien"] = review_data.get("paraQuien", "")
                
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                print(f"[{entry}] ✅ Guardado correctamente. ({time.time() - start:.1f}s)")
                count += 1
            else:
                print(f"[{entry}] ❌ Falló la generación.")

print(f"\nProceso completado. {count} nuevas reseñas generadas.")

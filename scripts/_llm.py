"""Client lleuger per fer crides a Ollama amb JSON mode.

Ús bàsic:
    from _llm import generate_json, MODEL
    data = generate_json(system="...", user="...")  # retorna dict parsejat

Variables d'entorn:
    LLM_MODEL    — model Ollama (default: qwen2.5:7b-instruct)
    LLM_HOST     — host (default: http://localhost:11434)
    LLM_TIMEOUT  — segons (default: 300)
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import requests

MODEL = os.environ.get("LLM_MODEL", "qwen2.5:7b-instruct")
HOST = os.environ.get("LLM_HOST", "http://localhost:11434").rstrip("/")
TIMEOUT = int(os.environ.get("LLM_TIMEOUT", "300"))


class LLMError(RuntimeError):
    pass


def generate_json(
    *,
    system: str,
    user: str,
    temperature: float = 0.3,
    max_retries: int = 2,
    num_ctx: int = 8192,
) -> dict[str, Any]:
    """Demana a Ollama una resposta en JSON estricte i la parseja.

    Reintenta fins a `max_retries` cops amb backoff exponencial si la
    crida falla o el JSON no es pot parsejar.
    """
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "format": "json",
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_ctx": num_ctx,
        },
    }
    last_err: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            r = requests.post(f"{HOST}/api/chat", json=body, timeout=TIMEOUT)
            r.raise_for_status()
            data = r.json()
            content = (data.get("message") or {}).get("content", "")
            if not content:
                raise LLMError("Resposta buida del model")
            return json.loads(content)
        except (requests.RequestException, json.JSONDecodeError, LLMError) as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(2 ** attempt)
                continue
            raise LLMError(f"LLM va fallar després de {max_retries+1} intents: {e}") from e
    raise LLMError(f"LLM va fallar: {last_err}")


def health_check() -> bool:
    """Comprova que el daemon respon i el model està disponible."""
    try:
        r = requests.get(f"{HOST}/api/tags", timeout=5)
        r.raise_for_status()
        names = {m.get("name") for m in r.json().get("models", [])}
        # Accepta variants: "qwen2.5:7b-instruct", "qwen2.5:7b-instruct-q4_K_M"...
        return any(MODEL in n or n.startswith(MODEL.split(":")[0]) for n in names)
    except Exception:
        return False

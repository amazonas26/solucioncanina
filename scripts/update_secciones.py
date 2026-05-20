#!/usr/bin/env python3
"""
Rellena o actualiza el campo `secciones` en cada producto del catálogo.

Uso:
    python scripts/update_secciones.py
    python scripts/update_secciones.py --dry-run
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from secciones_rules import compute_secciones, PROBLEM_SECTIONS  # noqa: E402

ROOT = Path(__file__).parent.parent
ART = ROOT / "src" / "content" / "articulos"


def parse_args(argv: list[str]) -> dict:
    return {"dry_run": "--dry-run" in argv}


def main() -> None:
    args = parse_args(sys.argv[1:])
    updated = 0
    unchanged = 0
    section_counts: dict[str, int] = {s["name"]: 0 for s in PROBLEM_SECTIONS}

    for path in sorted(ART.glob("*/index.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        secciones = compute_secciones(data)
        for name in secciones:
            section_counts[name] += 1

        if data.get("secciones") == secciones:
            unchanged += 1
            continue

        data["secciones"] = secciones
        updated += 1

        if args["dry_run"]:
            print(f"  ~ {path.parent.name}: {secciones}")
            continue

        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    print(f"Productos revisados: {unchanged + updated}")
    print(f"Actualizados: {updated}")
    print(f"Sin cambios: {unchanged}")
    print("\nProductos por sección:")
    for name, count in sorted(section_counts.items(), key=lambda x: (-x[1], x[0])):
        if count:
            print(f"  {name:>32}: {count}")

    if args["dry_run"] and updated:
        print("\n[DRY-RUN] Ejecuta sin --dry-run para escribir los cambios.")


if __name__ == "__main__":
    main()

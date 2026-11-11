#!/usr/bin/env python3
"""
Afegeix redirects 301 alhora a deploy/nginx/redirects.conf (el que serveix el VPS)
i a vercel.json (mirall que valida el comprovador d'enllaços del build).

Ús:
    python scripts/add_redirects.py /origen=/desti/ [/origen2=/desti2/ ...]
    python scripts/add_redirects.py --retarget /desti-vell/=/desti-nou/
        # reapunta els redirects existents que anaven a /desti-vell/ (evita cadenes
        # de 301 quan una pàgina destí es fusiona amb una altra)
    python scripts/add_redirects.py --dry-run ...

- Origen sense barra final (nginx rep les dues variants); destí intern amb barra final.
- Idempotent: un origen que ja existeix (a qualsevol dels dos fitxers) no es duplica.
- El snippet de nginx NO viatja amb deploy.sh: cal copiar-lo al VPS (es mostra com).
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent.parent
NGINX = ROOT / "deploy" / "nginx" / "redirects.conf"
VERCEL = ROOT / "vercel.json"


def norm_source(path: str) -> str:
    path = "/" + path.strip().strip("/")
    return path


def norm_dest(path: str) -> str:
    path = path.strip()
    if path.startswith("http"):
        return path
    return "/" + path.strip("/") + "/" if path.strip("/") else "/"


def nginx_pair(src: str, dest: str) -> str:
    return (
        f"location = {src} {{\n    return 301 {dest};\n}}\n"
        f"location = {src}/ {{\n    return 301 {dest};\n}}\n"
    )


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    retarget = "--retarget" in argv
    pairs = []
    for a in argv:
        if a.startswith("--"):
            continue
        if "=" not in a:
            print(f"Argument sense '=': {a}", file=sys.stderr)
            return 2
        src, dest = a.split("=", 1)
        pairs.append((src, dest))
    if not pairs:
        print(__doc__)
        return 2

    nginx = NGINX.read_text(encoding="utf-8")
    vercel = json.loads(VERCEL.read_text(encoding="utf-8"))

    if retarget:
        n_nginx = n_vercel = 0
        for old, new in pairs:
            old, new = norm_dest(old), norm_dest(new)
            nginx, k = re.subn(rf"return 301 {re.escape(old)};", f"return 301 {new};", nginx)
            n_nginx += k
            for r in vercel["redirects"]:
                if r.get("destination") == old:
                    r["destination"] = new
                    n_vercel += 1
            print(f"  {old} → {new}")
        print(f"Reapuntats: {n_nginx // 2} a nginx, {n_vercel} a vercel.json")
    else:
        nginx_sources = set(re.findall(r"location\s*=\s*(\S+?)/?\s*\{", nginx))
        vercel_sources = {norm_source(r["source"]) for r in vercel["redirects"] if "has" not in r}
        added = []
        for src, dest in pairs:
            src, dest = norm_source(src), norm_dest(dest)
            if src == dest.rstrip("/"):
                print(f"  ⚠ {src}: origen i destí iguals, saltat")
                continue
            if src in nginx_sources or src in vercel_sources:
                print(f"  · {src}: ja existeix, saltat")
                continue
            added.append((src, dest))
            print(f"  + {src} → {dest}")
        if added:
            nginx = nginx.rstrip("\n") + f"\n\n# Afegits {date.today().isoformat()} (scripts/add_redirects.py)\n"
            nginx += "\n".join(nginx_pair(s, d) for s, d in added)
            vercel["redirects"].extend({"source": s, "destination": d, "permanent": True} for s, d in added)
        print(f"Nous: {len(added)}")

    if dry:
        print("[dry-run] no s'ha escrit res.")
        return 0
    NGINX.write_text(nginx.rstrip("\n") + "\n", encoding="utf-8")
    VERCEL.write_text(json.dumps(vercel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\nRecorda: el snippet de nginx no es desplega amb deploy.sh. Al VPS:")
    print("  rsync -avz deploy/nginx/redirects.conf jan@ion:/tmp/")
    print("  sudo install -m 644 /tmp/redirects.conf /etc/nginx/snippets/solucioncanina-redirects.conf \\")
    print("    && sudo nginx -t && sudo systemctl reload nginx")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

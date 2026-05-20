#!/usr/bin/env python3
"""
Normalitza linkAmazon del catàleg amb el tag d'Associates.

Format canònic: https://www.amazon.es/dp/{ASIN}/?tag={STORE_ID}

Ús:
    python3 scripts/update_affiliate_links.py
    python3 scripts/update_affiliate_links.py --verify
    python3 scripts/update_affiliate_links.py --tag=solucioncanin-21 --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICULOS_DIR = ROOT / "src" / "content" / "articulos"
DEFAULT_TAG = "solucioncanin-21"

ASIN_RE = re.compile(r"/(?:dp|gp/product)/([A-Z0-9]{10})", re.IGNORECASE)
TAG_RE = re.compile(r"[?&]tag=([^&]+)", re.IGNORECASE)


def extract_asin(url: str) -> str | None:
    m = ASIN_RE.search(url)
    if m:
        return m.group(1).upper()
    m = re.search(r"/([B0-9][A-Z0-9]{9})(?:[/?]|$)", url, re.IGNORECASE)
    return m.group(1).upper() if m else None


def canonical_affiliate_url(asin: str, tag: str) -> str:
    return f"https://www.amazon.es/dp/{asin}/?tag={tag}"


def get_clean_amazon_url(url: str, tag: str) -> str | None:
    asin = extract_asin(url)
    if asin:
        return canonical_affiliate_url(asin, tag)
    if "tag=" in url:
        return re.sub(r"tag=[^&]+", f"tag={tag}", url)
    if url.strip():
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}tag={tag}"
    return None


@dataclass
class LinkIssue:
    slug: str
    kind: str
    detail: str
    url: str = ""


def audit_catalog(tag: str) -> tuple[list[Path], list[LinkIssue]]:
    paths = sorted(ARTICULOS_DIR.glob("*/index.json"))
    issues: list[LinkIssue] = []

    for path in paths:
        slug = path.parent.name
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            issues.append(LinkIssue(slug, "error", str(e)))
            continue

        url = (data.get("linkAmazon") or "").strip()
        if not url:
            issues.append(LinkIssue(slug, "missing", "linkAmazon buit"))
            continue

        asin = extract_asin(url)
        tag_m = TAG_RE.search(url)
        found_tag = tag_m.group(1) if tag_m else None

        if not asin:
            issues.append(LinkIssue(slug, "no_asin", "no es pot extreure ASIN", url))
            continue
        if not found_tag:
            issues.append(LinkIssue(slug, "no_tag", f"falta tag={tag}", url))
            continue
        if found_tag != tag:
            issues.append(
                LinkIssue(slug, "wrong_tag", f"tag={found_tag!r}, esperat {tag!r}", url)
            )
            continue

        expected = canonical_affiliate_url(asin, tag)
        if url != expected:
            issues.append(
                LinkIssue(
                    slug,
                    "non_canonical",
                    "funciona però no és el format canònic",
                    url,
                )
            )

    return paths, issues


def update_catalog(tag: str, dry_run: bool = False) -> tuple[int, int]:
    updated = 0
    category_count = 0

    for path in sorted(ARTICULOS_DIR.glob("*/index.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        original_url = (data.get("linkAmazon") or "").strip()
        original_category = data.get("categoria", "")
        changed = False

        if original_url:
            new_url = get_clean_amazon_url(original_url, tag)
            if new_url and new_url != original_url:
                data["linkAmazon"] = new_url
                changed = True
                updated += 1
                print(f"[{data.get('marca', path.parent.name)}] {original_url}\n  -> {new_url}")

        if original_category in ("Perros senior", "Suplementos"):
            data["categoria"] = "Condroprotectores"
            changed = True
            category_count += 1
            print(
                f"[{str(data.get('nombre', ''))[:40]}…] "
                f"categoria: {original_category} -> Condroprotectores"
            )

        if changed and not dry_run:
            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    return updated, category_count


def print_audit_report(paths: list[Path], issues: list[LinkIssue], tag: str) -> None:
    ok = len(paths) - len(issues)
    print(f"\n--- AUDITORIA ({tag}) ---")
    print(f"Productes revisats: {len(paths)}")
    print(f"Enllaços correctes: {ok}")
    print(f"Problemes: {len(issues)}")

    if issues:
        by_kind: dict[str, list[LinkIssue]] = {}
        for issue in issues:
            by_kind.setdefault(issue.kind, []).append(issue)
        for kind, items in sorted(by_kind.items()):
            print(f"\n  [{kind}] ({len(items)})")
            for item in items[:15]:
                print(f"    - {item.slug}: {item.detail}")
                if item.url:
                    print(f"      {item.url[:90]}{'…' if len(item.url) > 90 else ''}")
            if len(items) > 15:
                print(f"    … i {len(items) - 15} més")
    else:
        print("Tots els linkAmazon tenen ASIN + tag i format canònic.")
        print("Exemple:", canonical_affiliate_url("B0BJK9YF5N", tag))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audita i normalitza enllaços d'afiliats Amazon al catàleg."
    )
    parser.add_argument(
        "--tag",
        default=DEFAULT_TAG,
        help=f"Store ID Associates (per defecte: {DEFAULT_TAG})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra canvis sense escriure fitxers",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Només audita; no modifica res (exit 1 si hi ha problemes)",
    )
    args = parser.parse_args()
    tag = args.tag.strip()

    if not ARTICULOS_DIR.is_dir():
        print(f"Error: no existeix {ARTICULOS_DIR}", file=sys.stderr)
        return 1

    if args.verify:
        paths, issues = audit_catalog(tag)
        print_audit_report(paths, issues, tag)
        return 1 if issues else 0

    print(f"Buscant productes a: {ARTICULOS_DIR}\n")
    updated, cats = update_catalog(tag, dry_run=args.dry_run)
    print(f"\nURLs actualitzades: {updated}")
    print(f"Categories SEO: {cats}")
    if args.dry_run:
        print("(dry-run: no s'ha guardat res al disc)")

    paths, issues = audit_catalog(tag)
    print_audit_report(paths, issues, tag)
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())

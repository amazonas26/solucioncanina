#!/usr/bin/env python3
"""Redirigeix a scripts/update_affiliate_links.py (compatibilitat)."""
import runpy
from pathlib import Path

runpy.run_path(
    str(Path(__file__).resolve().parent.parent / "scripts" / "update_affiliate_links.py"),
    run_name="__main__",
)

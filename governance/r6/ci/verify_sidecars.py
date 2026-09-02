#!/usr/bin/env python3
"""Verify every *.json/*.md has a matching *.sha256 sidecar whose value matches.
Usage: verify_sidecars.py <dir>
"""
import hashlib, sys
from pathlib import Path

def sha256_file(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    root = Path(sys.argv[1])
    bad, ok = [], 0
    for sc in sorted(root.rglob("*.sha256")):
        text = sc.read_text(encoding="ascii").strip()
        parts = text.split()
        if len(parts) != 2:
            bad.append(f"{sc}: malformed sidecar"); continue
        sha, name = parts
        target = sc.parent / name
        if not target.exists():
            bad.append(f"{sc}: target missing {name}")
        elif sha256_file(target) != sha:
            bad.append(f"{sc}: sha mismatch")
        else:
            ok += 1
    print(f"SIDECARS_OK={ok} BAD={len(bad)}")
    for b in bad:
        print("  ", b)
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())

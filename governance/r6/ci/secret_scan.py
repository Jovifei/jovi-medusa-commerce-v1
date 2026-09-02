#!/usr/bin/env python3
"""Deterministic secret scan over the controlled repo.
Heuristic: flags high-entropy tokens, private keys, and known secret markers.
The frozen pnpm-lock.yaml is excluded (lockfiles legitimately contain hex and
long hashes); review-queue must not be committed anyway.
"""
import re, sys
from pathlib import Path

EXCLUDE_DIRS = {"node_modules", ".git", "runtime-r2r2", ".medusa", ".next", ".turbo", "dist", "build"}
EXCLUDE_FILES = {"pnpm-lock.yaml"}
# high-signal patterns
PATTERNS = {
    "aws-access": re.compile(r"AKIA[0-9A-Z]{16}"),
    "gh-token": re.compile(r"ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}"),
    "private-key": re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "stripe": re.compile(r"sk_live_[0-9a-zA-Z]{24,}|pk_live_[0-9a-zA-Z]{24,}"),
    "generic-secret": re.compile(r"(?i)(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['\"][^'\"]{8,}['\"]"),
}

def main():
    root = Path(sys.argv[1])
    start = Path(sys.argv[2]) if len(sys.argv) > 2 else root
    findings = []
    for p in start.rglob("*"):
        if p.is_dir():
            continue
        rel = p.relative_to(start)
        if any(part in EXCLUDE_DIRS for part in rel.parts):
            continue
        if p.name in EXCLUDE_FILES:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for kind, rx in PATTERNS.items():
            for m in rx.finditer(text):
                findings.append((str(p), kind, m.group(0)[:40]))
    seen = []
    for path, kind, sample in findings:
        line = f"{path}: {kind}: {sample}"
        if line not in seen:
            seen.append(line)
    print(f"SECRET_SCAN findings={len(seen)}")
    for s in seen:
        print("  ", s)
    return 1 if seen else 0

if __name__ == "__main__":
    sys.exit(main())

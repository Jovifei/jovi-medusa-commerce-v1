#!/usr/bin/env python3
"""Verify a source tree reproduces an expected canonical SHA (deterministic).
Usage: verify_source_tree.py <root> <expected_tree_sha256>
The canonical algorithm is the R2-R1 frozen snapshot_manifest.py tree()/digest().
"""
import hashlib, json, sys
from pathlib import Path

def digest(rows):
    return hashlib.sha256(json.dumps(rows, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()

def tree(root: Path):
    rows = []
    for p in sorted(root.rglob("*")):
        if p.is_symlink() or not p.is_file():
            continue
        data = p.read_bytes()
        rows.append({"path": p.relative_to(root).as_posix(),
                     "sha256": hashlib.sha256(data).hexdigest(),
                     "size": len(data)})
    return rows

def main():
    root = Path(sys.argv[1]); expected = sys.argv[2]
    got = digest(tree(root))
    if got != expected:
        print(f"TREE_SHA_MISMATCH got={got} expected={expected}")
        return 1
    print(f"TREE_SHA_OK {got} ({len(tree(root))} files)")
    return 0

if __name__ == "__main__":
    sys.exit(main())

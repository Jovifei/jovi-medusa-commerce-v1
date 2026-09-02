#!/usr/bin/env python3
"""License / SBOM check: assert the evidence SBOM and ADMIN_LICENSE_SCOPE are
present and that their bound Medusa tag is 2.19.0. Read-only.
"""
import json, sys
from pathlib import Path

def main():
    repo = Path(".").resolve()
    sbom = repo / "evidence/r2r2-freeze/MEDUSA_R2R2_SBOM.cdx.json"
    scope = repo / "evidence/r2r2-freeze/MEDUSA_R2R2_ADMIN_LICENSE_SCOPE.json"
    errs = []
    if not sbom.exists():
        errs.append("missing SBOM")
    if not scope.exists():
        errs.append("missing ADMIN_LICENSE_SCOPE")
    if sbom.exists():
        d = json.loads(sbom.read_text(encoding="utf-8"))
        if d.get("specVersion") != "1.5":
            errs.append(f"SBOM specVersion != 1.5 ({d.get('specVersion')})")
        comps = [c for c in d.get("components", []) if "admin" in c.get("name", "")]
        if len(comps) != 4:
            errs.append(f"expected 4 admin SBOM components, got {len(comps)}")
        if any(c.get("version") != "2.19.0" for c in comps):
            errs.append("admin SBOM version drift from 2.19.0")
    if scope.exists():
        d = json.loads(scope.read_text(encoding="utf-8"))
        if d.get("medusa_tag") != "v2.19.0":
            errs.append(f"medusa_tag != v2.19.0 ({d.get('medusa_tag')})")
    print("LICENSE_SBOM_OK" if not errs else "LICENSE_SBOM_FAIL " + "; ".join(errs))
    return 1 if errs else 0

if __name__ == "__main__":
    sys.exit(main())

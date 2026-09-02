# governance/r6 — R6 controlled repo adoption & import records

This directory holds the R6 executor control documents for
`JOVI-COMMERCE-R6-CONTROLLED-REPO-ADOPTION-AND-IMPORT-V1`, generated under
`JOVI-MEDUSA-R6-CONTROLLED-ADOPTION-DECISION-V1`.

## Documents

| File | Purpose |
|---|---|
| `R6_IMPORT_PLAN.json` (+ .sha256) | Plan, bindings, excluded items, phases |
| `R6_IMPORT_TARGET_SET.json` (+ .sha256) | The 74 exact import targets (source→dest + SHA) |
| `R6_SOURCE_PROVENANCE.json` (+ .sha256) | Source lineage & byte pinning |
| `R6_ROLLBACK_PLAN.json` (+ .sha256) | Rollback triggers & steps |
| `ci/verify_source_tree.py` | Recompute canonical tree SHA (deterministic) |
| `ci/verify_sidecars.py` | Verify evidence .sha256 sidecars |
| `ci/secret_scan.py` | Deterministic secret scan |
| `ci/license_check.py` | SBOM / license-scope sanity check |
| `ci/regression.sh` | Full synthetic Commerce regression over imported source |
| `BRANCH_PROTECTION_PLAN.md` | PR-only main + required checks plan |

## Import integrity (recorded 2026-09-03)

- 74 files byte-imported from the frozen R2-R2 source snapshot into `audit-source/`.
- Canonical tree SHA recomputed on the imported subtree = `e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa` (matches audited final source tree).
- Evidence frozen copies live under `evidence/r2r2-freeze/` with `.sha256` sidecars.

## Boundary

`production_integration_allowed=false`. No production/payment/Stripe/real-customer/
Storefront/Xianyu/n8n/R12 action is performed by this executor.

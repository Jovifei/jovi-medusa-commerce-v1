# jovi-medusa-commerce-v1

**Jovi Automation Commerce Core** — controlled adoption of Medusa v2.19.0 per `JOVI-MEDUSA-R6-CONTROLLED-ADOPTION-DECISION-V1`.

- **Decision:** `JOVI-MEDUSA-R6-CONTROLLED-ADOPTION-DECISION-V1` (human, Jovi, 2026-09-02)
- **Decision record:** source repo `docs/commerce/JOVI_MEDUSA_R6_CONTROLLED_ADOPTION_DECISION_V1.md`
- **Independent audit:** `MEDUSA_R2R2_PASS` (audit commit `6e59863787dfa73348971c694b774e5712950879`)
- **Status:** `READY_FOR_R6_POST_IMPORT_INDEPENDENT_AUDIT`
- **`production_integration_allowed=false`** — no production deployment, real payment, Stripe, real customer data, public Storefront, automatic delivery, Xianyu action, n8n production, or R12 supersede is authorized.

## Layout

```
governance/r6/    R6 import plan / target set / source provenance / rollback plan (+ .sha256)
audit-source/     the 74-file R2-R2 audited source snapshot, imported byte-for-byte
                  (canonical tree SHA256 e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa)
evidence/         frozen R2-R2 evidence: SBOM, LICENSE scope + source, Oracle, environment,
                  gate matrix, initial-source proof, source manifests (+ .sha256 sidecars)
.github/workflows/ CI: required checks, secret scan, license/SBOM, provenance, deterministic build
```

## Import integrity

- Import follows `governance/r6/R6_IMPORT_TARGET_SET.json` (74 entries), byte-for-byte from the frozen R2-R2 source snapshot.
- Re-verifying the imported tree with the canonical `snapshot_manifest.py tree()/digest()` algorithm reproduces `e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa`.
- Never commit `node_modules`, `.medusa`, `runtime-r2r2/**`, secrets, logs, or review-queue.

## Branching

- `main` is the protected, deployable baseline (PR-only).
- Development proceeds on a `development` branch; merge to `main` only via reviewed PR with required checks green.

## Governance

See `AGENTS.md` for role, boundaries, and required behavior. Synthetic Commerce verification and the independent Post-Import Audit are prerequisites before any further phase. Boundary flags remain `false`.

# Provenance — jovi-medusa-commerce-v1

## Source lineage (byte-pinned)

The Medusa backend source imported under `audit-source/` is the **R2-R2 audited
source snapshot** that an independent session verified as `MEDUSA_R2R2_PASS`:

- R2-R1 frozen baseline source tree: `d15eb73e94a1fcf8b19ac2c8e03b317fa5ea94f7d8242548aa3eac4dec334e8d` (73 files)
- → 3 documented deltas (M1 `--forceExit` removal; L1 read-only receipts route;
  isolation rename) → R2-R2 audited source tree:
  `e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa` (74 files)
- Imported **byte-for-byte**; canonical SHA re-verified in this repo =
  `e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa`

## Runtime / dependency pins

- Medusa `v2.19.0`, tag commit `87d77fa1b56ec287aa6655aaa2f54245387aa2f2`
- pnpm lockfile SHA `9855eabfc4fc37d916af0ac64585f15594b44a90dc6d8488d594789956237119`
- Node `22.17.1-bookworm-slim`
- PostgreSQL `16-alpine` `sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`
- Redis `7.2.11-alpine` `sha256:1cd18c9774579b583415e2a1ce464f183e5ed15203c5d8195dcfc6b9dc710cd1`
- Backend image ID `sha256:19da68692a32b02d98ada22d8a83633600978c2d19823c7aa104a43c8ac1ad62`; OCI source-tree / lock labels match the above.

## Evidence

Frozen R2-R2 evidence (SBOM, LICENSE scope, Oracle, environment, gate matrix,
initial-source proof, source manifests) is preserved under `evidence/r2r2-freeze/`
with `.sha256` sidecars; admin license texts + tarballs under
`evidence/r2r2-freeze/license-cache/`.

## Decision

All of the above was adopted only under `JOVI-MEDUSA-R6-CONTROLLED-ADOPTION-DECISION-V1`
(human, Jovi, 2026-09-02). `production_integration_allowed=false`.

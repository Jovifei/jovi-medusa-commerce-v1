# AGENTS.md — jovi-medusa-commerce-v1 (controlled repo)

## Role

You operate inside the Jovi controlled Commerce repo created under
`JOVI-MEDUSA-R6-CONTROLLED-ADOPTION-DECISION-V1`. Work here is **controlled,
reviewable, synthetic-only**. The authoritative rules of the parent engagement
(repo `jovi-automation`, file `AGENTS.md`) continue to apply.

## Absolute boundaries (never violate)

- `production_integration_allowed=false`.
- No production deployment, real payment, Stripe, real customer data, public
  Storefront, automatic delivery, Xianyu publish/message/payment/refund, n8n
  production, or R12 superseding.
- `audit-source/` is **byte-pinned** (tree SHA `e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa`).
  Never edit an imported file in place to "fix" something — change it through a
  reviewed migration / development-branch change on top, and keep provenance.
- Never commit `node_modules`, `.medusa`, `runtime-r2r2/**`, secrets, logs,
  review-queue, or test credentials.

## Where the real app lives and how to run it

The Medusa application lives under `audit-source/backend/jovi-medusa-backend`.
It is the byte-exact R2-R2 audited source. To build / test / run it, treat that
directory as the working root (it is a pnpm Turborepo monorepo):

```bash
cd audit-source/backend/jovi-medusa-backend
# package manager: pnpm@10.32.0 (see package.json "packageManager")
pnpm install --frozen-lockfile          # node_modules live here at runtime only, not committed
pnpm --filter @dtc/backend exec tsc --noEmit
pnpm --filter @dtc/backend exec medusa db:migrate
```

Compose stack (`audit-source/backend/jovi-medusa-backend/docker-compose.r2.yml`)
provisions PostgreSQL + Redis + backend + admin and is loopback-only. Runtime DB
and Redis data are written to `audit-source/runtime-r2r2/` which is git-ignored.
Fixtures live under `audit-source/tests/fixtures/...`.

## Import integrity

Re-verification of `audit-source/` must reproduce `e533f0ce...` using the
canonical algorithm in the R2-R1 frozen `snapshot_manifest.py`. Evidence copies
under `evidence/r2r2-freeze/` carry `.sha256` sidecars; any drift is a defect.

## Branching & reviews

- `main` = protected, PR-only baseline.
- `development` = integration branch.
- Every PR to `main` must pass required checks (see `.github/workflows/`): typecheck,
  unit, integration (needs Postgres), secret scan, license/SBOM, provenance/manifest
  validation, deterministic build. A failed check blocks merge.

## Current phase

`READY_FOR_R6_POST_IMPORT_INDEPENDENT_AUDIT`. Do not self-audit. When the
independent Post-Import Audit passes, Admin session closure (R2-R3) and full
synthetic Commerce E2E follow — still no real platform action.

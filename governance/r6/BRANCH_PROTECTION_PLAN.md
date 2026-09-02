# Branch protection plan — jovi-medusa-commerce-v1

Adopted under `JOVI-MEDUSA-R6-CONTROLLED-ADOPTION-DECISION-V1` (requirement 4:
PR-only main plan, required checks). Applies to the controlled Commerce repo.

## Branch model

- `main` — protected, deployable baseline. **PR-only**; no direct pushes.
- `development` — integration branch where the byte-pinned audited source and
  any subsequent reviewed changes live before merge.
- Feature branches are short-lived and merge into `development` via PR; only
  reviewed PRs merge `development` → `main`.

## Required checks (must be green to merge)

Enforced by `.github/workflows/ci.yml` and, where the platform allows, as GitHub
required status checks on `main`:

1. `static-checks` job
   - audited source tree SHA deterministic re-verify
   - evidence `.sha256` sidecar verify
   - frozen `pnpm install --frozen-lockfile`
   - TypeScript `tsc --noEmit` (deterministic)
   - secret scan (deterministic heuristic; lockfile excluded)
   - Jest unit (natural shutdown, no `--forceExit`)
   - license / SBOM sanity check
2. `integration` job (needs DB)
   - boot isolated PostgreSQL + Redis (loopback)
   - Jest module integration (natural shutdown)
   - full synthetic regression: X2 first/replay, concurrency, negative
     (`governance/r6/ci/regression.sh`)

## Additional enforced protections (recommended to enable on the remote)

- Branch protection on `main`: require pull request reviews (≥1), require status
  checks to pass, dismiss stale reviews, require linear history or no-force-push.
- Require conversation resolution before merging.
- No one (including admins) bypasses the checks by default; strict mode on.

## What these checks do NOT authorize

Green checks here prove synthetic Commerce behavior on byte-pinned audited source.
They do **not** authorize production deployment, real payment, Stripe, real
customer data, a public Storefront, automatic delivery, Xianyu, n8n production,
or R12 supersede. `production_integration_allowed=false` remains in force.

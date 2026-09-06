# C4 Runtime CI Baseline Reconciliation — 2026-09-06

**Status:** `C4_RUNTIME_CI_BASELINE_RECONCILIATION_PASS`

## Finding

Runtime PR #1 initially failed at `.github/workflows/ci.yml` before any unit/integration test ran.

The existing workflow still pinned the original R6-import `audit-source` canonical tree SHA256:

`e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa`

GitHub Actions recomputed the current PR checkout with the existing authoritative
`governance/r6/ci/verify_source_tree.py` algorithm and returned:

`3101604bf10c9c6ed3c9b67a23e5ef77a6704472835ccfd536c2cc0b6b8e568a`

## Why this is classified as a stale CI baseline

The C4 branch is based on audited C3 Runtime `main@63db06e9628331982893929f39b1037077138480`.

A GitHub compare of C3 `main` to `feature/c4-pre-publish-prep` shows **zero**
changes under `audit-source/**`; the C4 branch only adds governance evidence and
`.gitignore` rules. Therefore this mismatch was not introduced by C4.

R2-R3/C2/C3 intentionally evolved the controlled Runtime after the original R6
import, but the old R6 tree constant in the PR workflow was never advanced with
that audited Runtime mainline.

## Remediation

For this PR, the workflow baseline is advanced narrowly to the canonical tree
value recomputed by the existing verifier on the C3-derived checkout:

`3101604bf10c9c6ed3c9b67a23e5ef77a6704472835ccfd536c2cc0b6b8e568a`

No `audit-source/**` file is modified by this remediation.

The purpose is to make the PR gate validate **unexpected drift relative to the
current audited Runtime mainline**, rather than permanently compare all future
work to the historical R6 import snapshot.

## Acceptance

The reconciliation is accepted only if the updated PR subsequently runs the
full existing CI successfully, including:

- audited source-tree validation;
- evidence sidecar validation;
- frozen dependency install;
- TypeScript check;
- secret scan;
- unit tests;
- license/SBOM check;
- DB-backed integration;
- full synthetic regression.

Until that run is green, Runtime PR #1 must not be merged.

## Boundary

This is CI/governance maintenance only. It does not authorize C4 Human Pilot,
real payment/customer data, Xianyu automation, auto-delivery, refunds, or any
real-action flag change.

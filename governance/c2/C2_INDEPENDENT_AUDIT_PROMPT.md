# C2 Independent Audit Prompt

**Audit Type:** Independent Verification & Governance Audit (C2 Independent Auditor)  
**Target Repository:** `E:\project\jovi-medusa-commerce-v1`  
**Feature Branch:** `feature/c2-synthetic-commerce-e2e`  
**Baseline Branch:** `feature/r2r3-admin-session-cookie` (commit `363e1d6d45e5eb80242207aa1186716a1bce4c65`, R2-R3 PASS)  
**Audit Objective:** Independently verify the complete C2 Synthetic Commerce E2E digital delivery implementation:
1. Cross-language binary-exact deterministic ZIP delivery package matching Python Oracle;
2. Authenticated loopback HTTP download endpoint with single-use DownloadGrant token;
3. Playwright browser cookie-session admin SPA verification (no Bearer injection);
4. Idempotent replay and 10-concurrency distributed lock verification (zero duplicate entitlements);
5. 21 fail-closed unit negative tests (N01–N21) + 7 runtime database preservation negative tests;
6. Full regression test pass across both legacy X2 and new C2 suites;
7. Gitleaks secret scan (0 leaks) and Syft CycloneDX SBOM generation;
8. Strict preservation of 6 commercial boundaries (all `false`).

> **Hard Boundary:** This independent audit is **strictly read-only**. Do NOT modify code, do NOT merge to `main` or `development`, do NOT push to remote, and do NOT alter frozen evidence. The implementation agent MUST NOT self-complete or certify this audit. This prompt is prepared for execution by a separate independent auditor agent.

---

## 1. Prerequisites & Clean Workspace

- [ ] Confirm git branch is `feature/c2-synthetic-commerce-e2e`:
  ```bash
  git branch --show-current
  ```
- [ ] Confirm baseline R2-R3 Independent Audit passed:
  - `governance/r2r3/R2R3_INDEPENDENT_AUDIT_RESULT.md` has verdict `R2R3_INDEPENDENT_AUDIT_PASS`.
- [ ] Confirm `main` branch is untouched and remains at initial commit:
  ```bash
  git rev-parse main
  ```
- [ ] Confirm no remote exists or if remote is none, do NOT guess remote URL and do NOT push to Automation_Seal.

---

## 2. Canonical Source Tree Integrity & Code Delta

- [ ] Verify canonical source tree SHA over `audit-source/backend/jovi-medusa-backend`:
  ```bash
  python governance/r6/ci/verify_source_tree.py audit-source/backend/jovi-medusa-backend e3afca520386f043820dd7811a5b6ceb0dc7c8f9caa6c268f01d25edc347ed11
  ```
  Expected: `TREE_SHA_OK e3afca520386f043820dd7811a5b6ceb0dc7c8f9caa6c268f01d25edc347ed11 (82 files)`.
- [ ] Verify `pnpm-lock.yaml` SHA256 is unchanged:
  ```bash
  Get-FileHash -Path audit-source/backend/jovi-medusa-backend/pnpm-lock.yaml -Algorithm SHA256
  ```
  Expected: `9855eabfc4fc37d916af0ac64585f15594b44a90dc6d8488d594789956237119`.
- [ ] Verify zero modifications to `node_modules`.

---

## 3. Cross-Language Deterministic ZIP Binary Exactness

- [ ] Verify delivery ZIP byte-level exact match with Python Oracle:
  - Target Algorithm: `C2_DETERMINISTIC_ZIP_V1` (STORED / 0 compression, 1980-01-01 00:00:00 UTC, 0644 mode, ASCII sorted entries).
  - Target File: `SYNTH-C2-VALIDATION-PACK-1.0.0.zip`
  - Expected Byte Count: **2249 bytes**
  - Expected SHA256: `d13f5d95cc9e46bfa8a871e5a8542552a38964db1ff7fdd68cfedb83ab6623ca`
  - Expected Package Manifest SHA256: `382a5a016905e1d5290d599e55abf36e3a766a62ad1b10dea1a2fc5dc4d391f0`
- [ ] Run unit test:
  ```bash
  corepack pnpm --filter @dtc/backend exec jest src/modules/jovi-commerce/__tests__/c2-deterministic-zip.unit.spec.ts
  ```
  All 3 tests must PASS.

---

## 4. Fail-Closed Negative Tests & Path Traversal Guard

- [ ] Run the 21-case fail-closed negative unit test suite:
  ```bash
  corepack pnpm --filter @dtc/backend exec jest src/modules/jovi-commerce/__tests__/c2-negative.unit.spec.ts
  ```
  All 21 tests (N01–N21) must PASS:
  - N01: Non-original rights status rejected
  - N02: Prohibited content flag false rejected
  - N03: synthetic_only false rejected
  - N04: Missing assets rejected
  - N05: Path traversal (`../evil.txt`, `/abs/path`) rejected
  - N06: Empty asset rejected
  - N07: SHA256 mismatch rejected
  - N08: Size mismatch rejected
  - N09: Unexpected file in ZIP rejected
  - N10: DEFLATE compression rejected
  - N11: Non-1980 timestamp rejected
  - N12: Non-0644 permissions rejected
  - N13: Unsorted entries rejected
  - N14: Missing Grant token rejected (400)
  - N15: Invalid token signature rejected (403)
  - N16: Expired grant rejected (410)
  - N17: Revoked grant rejected (403)
  - N18: Mismatched run_id rejected (403)
  - N19: Max downloads exceeded rejected (429)
  - N20: Payment evidence mismatch rejected
  - N21: Non-synthetic order rejected

---

## 5. Playwright Admin Browser Cookie Session Verification

- [ ] Inspect `governance/c2/C2_ADMIN_SESSION_EVIDENCE.json` and verify screenshots in `governance/c2/screenshots/`:
  - `01-login-form.png`
  - `02-post-login-home.png`
  - `03-product-detail.png` (displays "Synthetic Commerce Validation Pack")
  - `04-order-detail.png` (displays C2 order)
  - `05-after-refresh.png` (session retained across browser reload)
- [ ] Re-run Playwright test if live containers are running:
  ```bash
  node governance/c2/verify_c2_admin_cookie_session.mjs
  ```
  Expected: `C2_ADMIN_SESSION_RESULT: C2_ADMIN_SESSION_PASS`.
  - `bearer_used_for_ui_acceptance: false`
  - `external_network_requests: 0`
  - `fatal_console_errors: 0`
  - `page_errors: 0`

---

## 6. Full Regression Verification

- [ ] Execute `governance/c2/regression.sh` in Git Bash:
  ```bash
  bash governance/c2/regression.sh
  ```
  Confirm all 11 steps exit with `exit=0`:
  1. `jest-unit` (9 suites / 41 tests passed)
  2. `jest-integration` (1 suite / 3 tests passed)
  3. `x2-first` (PASS)
  4. `x2-replay` (PASS)
  5. `x2-concurrency` (PASS, 10 runs / 1 unique)
  6. `x2-negative` (PASS, fail-closed)
  7. `c2-first` (PASS, package SHA256 matched)
  8. `c2-replay` (PASS, zero duplicates)
  9. `c2-concurrency` (PASS, 10 runs / 1 unique via Redis lock)
  10. `c2-negative` (PASS, 7 scenarios rejected, DB unchanged)
  11. `c2-http-download` (PASS, loopback HTTP 200, 2249 bytes, negative cases rejected)

---

## 7. OSS Wave 1 Security Tools Verification

- [ ] **Gitleaks (pinned image: `docker.io/zricethezav/gitleaks:v8.24.0`):**
  - Verify `governance/c2/c2-gitleaks-report.json`:
  - Scanned clean, exit code 0, 0 leaks found.
- [ ] **Syft (pinned image: `docker.io/anchore/syft:v1.20.0`):**
  - Verify `governance/c2/syft_source_sbom.cdx.json` (1,301 components).
  - Verify `governance/c2/syft_image_sbom.cdx.json` (6,310 components).
  - SHA256 matches sidecar files.

---

## 8. Commercial Boundaries & Fail-Closed Policy

- [ ] Confirm all 6 commercial boundary flags remain strictly `false`:
  - `production_integration_allowed = false`
  - `real_payment = false`
  - `real_customer = false`
  - `xianyu = false`
  - `auto_delivery = false`
  - `n8n_production = false`
- [ ] Confirm Xianyu draft bundle has `candidate_only: true` and `platform_action_allowed: false`.

---

## 9. Verdict Reporting

The independent auditor shall generate `governance/c2/C2_INDEPENDENT_AUDIT_RESULT.md` with:
- Executive Verdict: `C2_INDEPENDENT_AUDIT_PASS` or `C2_INDEPENDENT_AUDIT_FAIL`
- Exact observed hashes for all evidence files
- Verification table for sections 1 through 8
- Certification that the implementation meets all requirements without unauthorized side-effects

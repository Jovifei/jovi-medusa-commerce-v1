# R2-R3 Independent Audit Prompt

**Audit Type:** Independent Verification & Hardening Audit (R2-R3 Independent Auditor)  
**Target Repository:** E:\\project\\jovi-medusa-commerce-v1  
**Feature Branch:** eature/r2r3-admin-session-cookie  
**Baseline Branch:** development (commit e8c8a783daefc9cf9fead22091ebc4bf190e3d54, R6_POST_IMPORT_PASS)  
**Audit Objective:** Independently verify closure of R2-R2 Low findings F-1 (missing admin session-cookie) and F-2 (hardcoded evidence), verify fail-closed guard, Playwright E2E session authentication, full regression, and Wave 1 OSS security tools (Gitleaks + Syft).

> **Hard Boundary:** This independent audit is **strictly read-only**. Do NOT modify code, do NOT merge to main or development, do NOT alter frozen evidence, and do NOT perform any real-world commercial or platform actions. The current implementation agent must NOT self-complete this audit. This prompt is prepared for a separate independent session.

---

## 1. Prerequisites to Verify

- [ ] Confirm baseline R6 Post-Import Audit passed: governance/r6/post-import-evidence/R6_POST_IMPORT_INDEPENDENT_AUDIT_RESULT.md has verdict R6_POST_IMPORT_PASS and SHA256 matches sidecar (32f973736f8729ae417a7d253ae1cb9e6b9454e3b780c4c38bfc1374562f1e69).
- [ ] Confirm main branch is untouched and remains at baseline 8290392.
- [ ] Confirm no remote exists or if remote is none, do NOT guess remote URL and do NOT push to Automation_Seal.

---

## 2. Source Tree Integrity & Code Delta

- [ ] Recompute canonical source tree SHA over udit-source/:
  - Expected: 664d73663ffce757bdf394a293c5642720fad5cb0afa1564619f53e845090602
  - Exact file count: **76 files** (74 original + 2 added: session-cookie.ts and session-cookie.unit.spec.ts).
- [ ] Confirm zero modifications to 
ode_modules and zero monkey-patches to Medusa upstream session route.
- [ ] Confirm pnpm-lock.yaml SHA256 is unchanged (9855eabfc4fc37d916af0ac64585f15594b44a90dc6d8488d594789956237119).

---

## 3. Cookie Configuration & Fail-Closed Guard

- [ ] Verify udit-source/backend/jovi-medusa-backend/apps/backend/src/modules/jovi-commerce/session-cookie.ts:
  - When JOVI_SYNTHETIC_LOOPBACK_HTTP is unset or false: secure=true, sameSite=lax, httpOnly=true.
  - When JOVI_SYNTHETIC_LOOPBACK_HTTP=true (synthetic loopback): secure=false, sameSite=lax, httpOnly=true.
  - When JOVI_SYNTHETIC_LOOPBACK_HTTP=true AND any real commerce / production flag is true: throws SYNTHETIC_LOOPBACK_COOKIE_OVERRIDE_FORBIDDEN_IN_REAL_COMMERCE.
- [ ] Run unit tests:
  `ash
  corepack pnpm --filter @dtc/backend exec jest src/modules/jovi-commerce/__tests__/session-cookie.unit.spec.ts
  `
  All 5 tests must PASS.

---

## 4. Playwright Cookie Session Verification

- [ ] Inspect governance/r2r3/R2R3_ADMIN_SESSION_EVIDENCE.json and optionally re-run:
  `ash
  node governance/r2r3/verify_admin_cookie_session.mjs
  `
- [ ] Verify the following runtime facts:
  1. /app/login form submitted with synthetic credentials;
  2. POST /auth/user/emailpass = 200;
  3. POST /auth/session = 200 with real response header Set-Cookie containing connect.sid;
  4. Browser cookie jar contains connect.sid (httpOnly: true, sameSite: Lax);
  5. URL navigates away from /app/login;
  6. GET /admin/users/me accessed via cookie-session only = 200 (earer_used_for_ui_acceptance: false);
  7. Product detail page rendered with title;
  8. Order detail page rendered with title;
  9. Read-only /admin/jovi-commerce/receipts endpoint returns 200 with entitlement/receipt data;
  10. Session retained after page reload;
  11. atal_console_errors == 0, page_errors == 0, external_network_requests == 0.

---

## 5. Full Regression Re-Verification

- [ ] Run governance/r2r3/regression.sh:
  - TypeScript: exit code 0;
  - Jest Unit: 7 suites, 17 tests passed, natural exit;
  - Jest Integration: 1 suite, 3 tests passed;
  - X2 First run: READY_FOR_HUMAN_DELIVERY;
  - X2 Replay: READY_FOR_HUMAN_DELIVERY (semantic parity);
  - X2 Concurrency: 10 runs, 1 unique result;
  - X2 Negative: 6 cases rejected fail-closed, DB unchanged;
  - Oracle comparison: 7/7 per-file SHA equality.

---

## 6. OSS Wave 1 Security Tools

- [ ] **Gitleaks (pinned image: zricethezav/gitleaks:v8.24.0):**
  - Clean repository scan: exit code 0, 0 leaks;
  - Synthetic fake secret fixture: exit code 1 (must detect leak);
  - Post-removal scan: exit code 0, 0 leaks;
  - Dual-track with existing secret_scan.py maintained.
- [ ] **Syft (pinned image: nchore/syft:v1.20.0):**
  - Source SBOM (governance/r2r3/syft_source_sbom.cdx.json): SHA256 matches sidecar;
  - Image SBOM (governance/r2r3/syft_image_sbom.cdx.json): SHA256 matches sidecar;
  - Key dependencies mapped: @medusajs/medusa: 2.19.0, @medusajs/framework: 2.19.0, @medusajs/admin-sdk: 2.19.0, ioredis, pg, ullmq.

---

## 7. Boundary Enforcement

- [ ] Confirm all boundary flags remain strictly false:
  - production_integration_allowed = false
  - 
eal_payment = false
  - 
eal_customer = false
  - xianyu = false
  - uto_delivery = false
  - 
8n_production = false

---

## 8. Verdict

Conclusion must be exactly one of:
- R2R3_INDEPENDENT_AUDIT_PASS
- R2R3_INDEPENDENT_AUDIT_FAIL

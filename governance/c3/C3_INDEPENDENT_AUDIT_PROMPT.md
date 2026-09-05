# C3 Real SKU Staging — Independent Audit Prompt

You are a fresh, read-only **C3 Real SKU Staging Independent Auditor**.
You did not implement C3 and must remain strictly read-only.
Target Runtime: `E:\project\jovi-medusa-commerce-v1` (branch `feature/c3-modbus-real-sku-staging`)
Target product source: `E:\project\jovi-modbus-diagnostic-toolkit-v1` (HEAD `25ef15386b21bcc53277c0d5af5973ad8ea272eb`)

Your final verdict may only be:
- `C3_REAL_SKU_STAGING_INDEPENDENT_AUDIT_PASS`
- `C3_REAL_SKU_STAGING_INDEPENDENT_AUDIT_FAIL`

Do not fix findings yourself.

## 1. Recompute Predecessors
Independently verify:
- Base commit: `ce25c9e2a660b1f6b64ead3192ff861b3a8a19fa`
- C2 audit result SHA256: `30346ddbc5dc34a6d60d785c2d4a26cb5ac25862c8212c42cacddd92563c71d1` (verdict `C2_INDEPENDENT_AUDIT_PASS`)
- Six real-action flags must be false:
  - `production_integration_allowed = false`
  - `real_payment = false`
  - `real_customer = false`
  - `xianyu = false`
  - `auto_delivery = false`
  - `n8n_production = false`

## 2. Verify C3 Implementation Boundary
- Confirm branch `feature/c3-modbus-real-sku-staging` was branched from `ce25c9e`.
- Confirm Runtime `main` (`8290392c7fb91b1266d37591524d09005feac39d`) is clean and unmodified.
- Confirm product repo `E:\project\jovi-modbus-diagnostic-toolkit-v1` is clean, untouched, and zero writes occurred.

## 3. Product Source Qualification & Zero-Write
- Run independently:
  `python E:\project\jovi-automation\scripts\commerce\c3_verify_product_zero_write.py --product-root "E:\project\jovi-modbus-diagnostic-toolkit-v1" --qualification "E:\project\jovi-medusa-commerce-v1\governance\c3\C3_MODBUS_SOURCE_QUALIFICATION.json" --proof "E:\project\jovi-medusa-commerce-v1\governance\c3\C3_PRODUCT_SOURCE_ZERO_WRITE_PROOF.json"`
  Must output: `C3_PRODUCT_SOURCE_ZERO_WRITE_PASS`
- Verify product HEAD equals `25ef15386b21bcc53277c0d5af5973ad8ea272eb`.
- Verify deliverables match:
  - `build/installer/JoviModbusDiagnosticToolkit-0.2.0-dev-unsigned.exe`: SHA256 `d86ccc3136bc2ed201622c5f961738e9e81762e74e71ac5772ea6d4b5a408e02`, size `34563797`
  - `build/JoviModbusDiagnosticToolkit-portable.zip`: SHA256 `7525e4c8d4fd55900d46c51e075b92e47d61c7d8e1393383e2e92206855a9628`, size `48288685`

## 4. Run Cloud Readiness Verifier
- Run independently:
  `python E:\project\jovi-automation\scripts\commerce\c3_verify_real_sku_readiness.py --product-root "E:\project\jovi-modbus-diagnostic-toolkit-v1" --evidence-dir "E:\project\jovi-medusa-commerce-v1\governance\c3"`
  Must output: `C3_REAL_SKU_READINESS_PASS`

## 5. Verify All Bound Hashes in Release Candidate
- Inspect `C3_RELEASE_CANDIDATE.json`:
  - `source_qualification_sha256`: `cd86ada81b4de4a423f5013045f2b0a473b6c64ab903dc31e9d793f35cad756b`
  - `product_source_zero_write_proof_sha256`: `d725d7f5e5facedbcaec286df0b5aeb872ba20729e6ba35de067ad3d1c8e09d9`
  - `product_manifest_sha256`: `879fdff9a7148f9730f773e9a012cf0dfe68b107ababf850585348f54def4e66`
  - `listing_claim_evidence_sha256`: `471fc8bcbf6d48c4850a54baa533698e4c71b5d3c5a673e024e2c6ba6e5c3623`
  - `listing_candidate_sha256`: `d0c3c3a7df393a004171e1e2e6d8e541f828a4074a5a19b99080365b11e076d0`
  - `xianyu_draft_bundle_sha256`: `7267090af86111904ec0fb75bf643c575c803788e3b4a86b007aea5c2344c098`
  - `delivery_package_sha256`: `4bd5703ae80fcea9c1dcf7d5d1ea2a02fe282a5cf6ef3f04a2c9703db5188e59`
  - `downloaded_package_sha256`: `4bd5703ae80fcea9c1dcf7d5d1ea2a02fe282a5cf6ef3f04a2c9703db5188e59`
  - `synthetic_order_id`: `order_c3_modbus_rtu_synthetic_01`
  - `entitlement_count`: 1
  - `delivery_receipt_count`: 1
  - `download_grant_verified`: true
  - `replay_unique_result`: true
  - `recovery_unique_result`: true
  - `candidate_only`: true
  - `final_state`: `READY_FOR_HUMAN_DELIVERY`

## 6. Stop Condition
If PASS, record `C3_REAL_SKU_STAGING_INDEPENDENT_AUDIT_PASS` with sidecar.
Do not promote Runtime main, do not execute real platform actions.

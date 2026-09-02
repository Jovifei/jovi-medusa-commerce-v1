import { issueEntitlement, prepareDigitalDelivery, validateAsset, validateEvidence } from "../domain"
import { createHash } from "node:crypto"

const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const paymentContent = '{"amount":"19.90","currency":"cny","mode":"synthetic"}'
const rightsContent = '{"product_id":"synthetic-digital-checklist","rights_status":"ORIGINAL"}'
const A = digest(paymentContent)
const B = digest(rightsContent)
const provenance = { environment: "SYNTHETIC_X2" as const, synthetic_only: true as const, test_run_id: "x2_0123456789abcdef", source_fixture_sha256: B, real_commerce_pilot_started: false as const }
const paymentEvidence = { evidence_id: "evidence_payment_1", evidence_sha256: A, kind: "SYNTHETIC_PAYMENT" as const, payload_sha256: A, content: paymentContent }
const asset = { asset_id: "synthetic-digital-checklist", version: "1.0.0", rights_status: "ORIGINAL" as const, manifest_sha256: A, package_files: ["assets/checklist.txt"], provenance, rights_evidence_sha256: B }

describe("Jovi synthetic domain", () => {
  test("requires fail-closed provenance and evidence", () => {
    expect(validateAsset(asset).provenance).toEqual(provenance)
    expect(validateEvidence(paymentEvidence, "SYNTHETIC_PAYMENT")).toEqual(paymentEvidence)
    expect(() => validateEvidence({ ...paymentEvidence, content: "tampered" }, "SYNTHETIC_PAYMENT")).toThrow("EVIDENCE_CONTENT")
    expect(() => validateAsset({ ...asset, provenance: { ...provenance, synthetic_only: false as never } })).toThrow("PROVENANCE")
    expect(() => validateEvidence({ ...paymentEvidence, evidence_sha256: "bad" }, "SYNTHETIC_PAYMENT")).toThrow("EVIDENCE")
  })

  test("rejects unknown paths and unsupported rights evidence", () => {
    expect(() => validateAsset({ ...asset, package_files: ["assets/../unknown.txt"] })).toThrow("ASSET")
    expect(() => validateAsset({ ...asset, rights_evidence_sha256: "bad" })).toThrow("ASSET")
    expect(() => validateEvidence({ ...paymentEvidence, kind: "SYNTHETIC_RIGHTS" }, "SYNTHETIC_PAYMENT")).toThrow("EVIDENCE")
  })

  test("issues and prepares deterministic single-user delivery", () => {
    const entitlement = issueEntitlement("order_1", paymentEvidence, asset, provenance.test_run_id, B, "2026-08-31T00:00:00.000Z")
    const first = prepareDigitalDelivery(entitlement, asset, provenance.test_run_id)
    expect(entitlement.order_id).toBe("order_1")
    expect(entitlement.payment_evidence_sha256).toBe(A)
    expect(entitlement.provenance).toEqual(provenance)
    expect(prepareDigitalDelivery(entitlement, asset, provenance.test_run_id)).toEqual(first)
    expect(first.auto_send).toBe(false)
  })
})

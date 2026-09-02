import { createHash } from "node:crypto"

export type RightsStatus = "ORIGINAL" | "VERIFIED_LICENSE"
export type SyntheticProvenance = {
  environment: "SYNTHETIC_X2"
  synthetic_only: true
  test_run_id: string
  source_fixture_sha256: string
  real_commerce_pilot_started: false
}
export type EvidenceRef = {
  evidence_id: string
  evidence_sha256: string
  kind: "SYNTHETIC_PAYMENT" | "SYNTHETIC_RIGHTS"
  payload_sha256: string
  content: string
}
export type JoviAsset = {
  asset_id: string
  version: string
  rights_status: RightsStatus
  manifest_sha256: string
  package_files: string[]
  provenance: SyntheticProvenance
  rights_evidence_sha256: string
}
export type JoviEntitlement = {
  entitlement_id: string
  order_id: string
  product_id: string
  version: string
  license_type: "SINGLE_USER"
  terms_sha256: string
  payment_evidence_sha256: string
  run_id: string
  issued_at: string
  provenance: SyntheticProvenance
}
export type JoviDeliveryReceipt = {
  delivery_id: string
  order_id: string
  entitlement_id: string
  status: "READY_FOR_HUMAN_DELIVERY"
  package_manifest_sha256: string
  auto_send: false
  run_id: string
  provenance: SyntheticProvenance
}

const isSha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value)
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const hashText = (value: string) => createHash("sha256").update(value, "utf8").digest("hex")

export function validateProvenance(value: SyntheticProvenance): SyntheticProvenance {
  if (value?.environment !== "SYNTHETIC_X2" || value.synthetic_only !== true || value.real_commerce_pilot_started !== false || !/^x2_[0-9a-f]{16,64}$/.test(value.test_run_id) || !isSha256(value.source_fixture_sha256)) {
    throw new Error("INVALID_SYNTHETIC_PROVENANCE")
  }
  return { ...value }
}

export function validateEvidence(value: EvidenceRef, expectedKind: EvidenceRef["kind"]): EvidenceRef {
  if (value.kind !== expectedKind || !value.evidence_id || typeof value.content !== "string" || value.content.length === 0 || !isSha256(value.evidence_sha256) || !isSha256(value.payload_sha256)) throw new Error("INVALID_EVIDENCE_REF")
  const contentSha256 = hashText(value.content)
  if (contentSha256 !== value.evidence_sha256 || contentSha256 !== value.payload_sha256) throw new Error("INVALID_EVIDENCE_CONTENT")
  return { ...value }
}

export function validateAsset(input: JoviAsset): JoviAsset {
  const provenance = validateProvenance(input.provenance)
  if (!["ORIGINAL", "VERIFIED_LICENSE"].includes(input.rights_status) || !input.asset_id || !input.version || !isSha256(input.manifest_sha256) || !isSha256(input.rights_evidence_sha256)) throw new Error("INVALID_ASSET")
  const files = [...input.package_files]
  if (!files.length || new Set(files).size !== files.length || files.some((path) => !/^assets\/[^/]+(?:\/[^/]+)*$/.test(path) || path.split("/").some((part) => part === "." || part === ".."))) throw new Error("INVALID_ASSET_FILE_ALLOWLIST")
  return { ...input, package_files: files.sort(), provenance }
}

export function issueEntitlement(orderId: string, paymentEvidence: EvidenceRef, assetInput: JoviAsset, runId: string, termsSha256: string, issuedAt = new Date().toISOString()): JoviEntitlement {
  const asset = validateAsset(assetInput)
  validateEvidence(paymentEvidence, "SYNTHETIC_PAYMENT")
  if (!/^x2_[0-9a-f]{16,64}$/.test(runId) || !isSha256(termsSha256)) throw new Error("INVALID_ISSUANCE_INPUT")
  if (!orderId) throw new Error("INVALID_ORDER_ID")
  const identity = hash({ order_id: orderId, asset_id: asset.asset_id, version: asset.version, terms_sha256: termsSha256 })
  return { entitlement_id: `ent_${identity.slice(0, 24)}`, order_id: orderId, product_id: asset.asset_id, version: asset.version, license_type: "SINGLE_USER", terms_sha256: termsSha256, payment_evidence_sha256: paymentEvidence.evidence_sha256, run_id: runId, issued_at: issuedAt, provenance: asset.provenance }
}

export function prepareDigitalDelivery(entitlement: JoviEntitlement, assetInput: JoviAsset, runId: string, packageManifestSha256?: string): JoviDeliveryReceipt {
  const asset = validateAsset(assetInput)
  if (entitlement.product_id !== asset.asset_id || entitlement.version !== asset.version || entitlement.run_id !== runId) throw new Error("ISSUANCE_ASSET_MISMATCH")
  const manifest = packageManifestSha256 ?? hash({ asset_id: asset.asset_id, entitlement_id: entitlement.entitlement_id, manifest_sha256: asset.manifest_sha256, package_files: asset.package_files, version: asset.version })
  if (!isSha256(manifest)) throw new Error("INVALID_PACKAGE_MANIFEST")
  return { delivery_id: `delivery_${hash({ order_id: entitlement.order_id, packageManifestSha256: manifest }).slice(0, 24)}`, order_id: entitlement.order_id, entitlement_id: entitlement.entitlement_id, status: "READY_FOR_HUMAN_DELIVERY", package_manifest_sha256: manifest, auto_send: false, run_id: runId, provenance: asset.provenance }
}

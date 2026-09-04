import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createHash } from "node:crypto"
import { setTimeout as wait } from "node:timers/promises"
import { issueEntitlement, prepareDigitalDelivery, validateAsset, validateEvidence, type EvidenceRef, type JoviAsset, type JoviEntitlement, type JoviDeliveryReceipt, type SyntheticProvenance } from "./domain"
import { validateSyntheticCore, type VerifiedSyntheticCore } from "./medusa-binding"
import JoviAssetModel from "./models/jovi-asset"
import JoviDeliveryReceiptModel from "./models/jovi-delivery-receipt"
import JoviEntitlementModel from "./models/jovi-entitlement"
import JoviEvidenceModel from "./models/jovi-evidence"
import JoviRunModel from "./models/jovi-run"

export type SyntheticIssuanceInput = {
  run_id: string
  order_id: string
  payment_collection_id: string
  payment_evidence: EvidenceRef
  rights_evidence: EvidenceRef
  asset: JoviAsset
  medusa_product_id: string
  medusa_variant_id: string
  currency_code: string
  amount: string
  terms_sha256: string
  source_fixture_path: string
  package_manifest_sha256?: string
  payment_snapshot_sha256?: string
}

const BaseService = MedusaService({
  JoviAsset: JoviAssetModel,
  JoviEntitlement: JoviEntitlementModel,
  JoviDeliveryReceipt: JoviDeliveryReceiptModel,
  JoviEvidence: JoviEvidenceModel,
  JoviRun: JoviRunModel,
})

type WorkflowCapability = object
const workflowCapabilities = new WeakSet<object>()
const mintWorkflowCapability = (): WorkflowCapability => {
  const capability = Object.freeze({})
  workflowCapabilities.add(capability)
  return capability
}
const requireWorkflowCapability = (capability: unknown) => {
  if (!capability || typeof capability !== "object" || !workflowCapabilities.has(capability)) throw new Error("WORKFLOW_CAPABILITY_REQUIRED")
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}

const intentHash = (input: SyntheticIssuanceInput) => createHash("sha256").update(stableStringify({ ...input, amount: Number(input.amount).toFixed(2), currency_code: input.currency_code.toLowerCase() })).digest("hex")
const withoutTransaction = (context: Context) => {
  const copy = { ...context } as Record<string, unknown>
  delete copy.transactionManager
  return copy as Context
}
const list = async (service: any, method: string, filters: Record<string, unknown>, context?: Context) => service[method](filters, {}, context)
const same = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right)
const project = (record: any, fields: string[]) => Object.fromEntries(fields.map((field) => [field, record[field]]))

class JoviCommerceModuleService extends BaseService {
  private readonly orderModule: any
  private readonly paymentModule: any

  constructor(cradle: Record<string, any>, options?: any, moduleDeclaration?: any) {
    super(cradle, options, moduleDeclaration)
    const optional = (key: string) => { try { return cradle[key] } catch { return undefined } }
    this.orderModule = optional(Modules.ORDER)
    this.paymentModule = optional(Modules.PAYMENT)
    const mutationMethods = [
      "createJoviAssets", "updateJoviAssets", "deleteJoviAssets", "restoreJoviAssets",
      "createJoviEntitlements", "updateJoviEntitlements", "deleteJoviEntitlements", "restoreJoviEntitlements",
      "createJoviDeliveryReceipts", "updateJoviDeliveryReceipts", "deleteJoviDeliveryReceipts", "restoreJoviDeliveryReceipts",
      "createJoviEvidences", "updateJoviEvidences", "deleteJoviEvidences", "restoreJoviEvidences",
      "createJoviRuns", "updateJoviRuns", "deleteJoviRuns", "restoreJoviRuns",
    ]
    for (const name of mutationMethods) Object.defineProperty(this, name, { value: async () => { throw new Error("POLICY_COMMAND_REQUIRED") }, configurable: false, enumerable: false, writable: false })
  }

  async runSyntheticIssuance(input: SyntheticIssuanceInput, capability: WorkflowCapability, @MedusaContext() context: Context = {}) {
    requireWorkflowCapability(capability)
    if (!context.transactionId || !context.runId) throw new Error("WORKFLOW_CONTEXT_REQUIRED")
    if (context.runId !== input.run_id) throw new Error("WORKFLOW_RUN_MISMATCH")
    if (!this.orderModule || !this.paymentModule) throw new Error("MEDUSA_DEPENDENCIES_REQUIRED")
    validateAsset(input.asset)
    validateEvidence(input.payment_evidence, "SYNTHETIC_PAYMENT")
    validateEvidence(input.rights_evidence, "SYNTHETIC_RIGHTS")
    if (input.rights_evidence.evidence_sha256 !== input.asset.rights_evidence_sha256) throw new Error("RIGHTS_EVIDENCE_NOT_BOUND")
    if (!/^\d+\.\d{2}$/.test(input.amount) || input.currency_code.toLowerCase() !== "cny") throw new Error("INVALID_SYNTHETIC_PRICE")
    if (input.source_fixture_path !== "tests/fixtures/synthetic-digital-checklist" && input.source_fixture_path !== "tests/fixtures/c2-synthetic-digital-pack" && !input.source_fixture_path.includes("c2")) throw new Error("FIXTURE_SOURCE_NOT_ALLOWED")
    const verified = await validateSyntheticCore({ payment: this.paymentModule, order: this.orderModule }, input)
    const provenance: SyntheticProvenance = verified.asset.provenance

    const cleanContext = withoutTransaction(context)
    const intent_sha256 = intentHash(verified)
    const [existing] = await list(this, "listJoviRuns", { run_id: input.run_id })
    if (existing?.intent_sha256 && existing.intent_sha256 !== intent_sha256) throw new Error("RUN_INTENT_CONFLICT")
    if (existing && ![
      ["order_id", input.order_id], ["payment_collection_id", input.payment_collection_id], ["product_id", input.medusa_product_id], ["variant_id", input.medusa_variant_id],
      ["environment", provenance.environment], ["source_fixture_sha256", provenance.source_fixture_sha256], ["synthetic_only", true], ["real_commerce_pilot_started", false], ["payment_snapshot_sha256", verified.payment_snapshot_sha256],
    ].every(([field, value]) => same(existing[field as string], value))) throw new Error("RUN_BINDING_CONFLICT")
    const run = existing ?? await this.createRun({
      run_id: input.run_id,
      intent_sha256,
      state: "RECOVERY_PENDING",
      order_id: input.order_id,
      payment_collection_id: input.payment_collection_id,
      product_id: input.medusa_product_id,
      variant_id: input.medusa_variant_id,
      environment: provenance.environment,
      source_fixture_sha256: provenance.source_fixture_sha256,
      synthetic_only: true,
      real_commerce_pilot_started: false,
      provenance,
      payment_snapshot_sha256: verified.payment_snapshot_sha256,
      error_code: null,
    }, cleanContext)

    if (run.state === "FAILED") await this.updateRun({ id: run.id, state: "RECOVERY_PENDING", error_code: null }, cleanContext)
    return this.persistSyntheticIssuance(verified, run, capability, context)
  }

  @InjectTransactionManager()
  async persistSyntheticIssuance(input: VerifiedSyntheticCore, run: any, capability: WorkflowCapability, @MedusaContext() context: Context = {}) {
    requireWorkflowCapability(capability)
    const normalizedAsset = validateAsset(input.asset)
    const provenance = normalizedAsset.provenance
    const wasReady = run.state === "READY_FOR_HUMAN_DELIVERY"
    const evidenceRows = await list(this, "listJoviEvidences", { run_id: input.run_id }, context)
    if (run.payment_snapshot_sha256 !== input.payment_snapshot_sha256) throw new Error("RUN_PAYMENT_SNAPSHOT_CONFLICT")
    const bindings = [
      { ref: input.payment_evidence, metadata: { order_id: input.order_id, payment_collection_id: input.payment_collection_id, currency_code: input.currency_code.toLowerCase(), amount: input.amount, product_id: input.asset.asset_id, version: input.asset.version, terms_sha256: input.terms_sha256, payment_snapshot_sha256: input.payment_snapshot_sha256, source_path: `runtime/evidence/${input.run_id}/payment-evidence.json` } },
      { ref: input.rights_evidence, metadata: { order_id: input.order_id, payment_collection_id: input.payment_collection_id, currency_code: input.currency_code.toLowerCase(), amount: input.amount, product_id: input.asset.asset_id, version: input.asset.version, terms_sha256: input.terms_sha256, payment_snapshot_sha256: null, source_path: input.source_fixture_path.includes("c2") ? `${input.source_fixture_path}/product-manifest.json` : `${input.source_fixture_path}/product.json` } },
    ]
    for (const binding of bindings) {
      validateEvidence(binding.ref, binding.ref.kind)
      let payload: Record<string, unknown>
      try { payload = JSON.parse(binding.ref.content) as Record<string, unknown> } catch { throw new Error("EVIDENCE_CONTENT_NOT_JSON") }
      const required = binding.ref.kind === "SYNTHETIC_PAYMENT"
        ? { amount: input.amount, currency: input.currency_code.toLowerCase(), order_id: input.order_id, payment_collection_id: input.payment_collection_id, product_id: input.asset.asset_id, run_id: input.run_id, version: input.asset.version, payment_snapshot_sha256: input.payment_snapshot_sha256 }
        : { product_id: input.asset.asset_id, rights_status: String(input.asset.rights_status).toUpperCase(), version: input.asset.version }
      for (const [key, expectedValue] of Object.entries(required)) {
        let actualValue = payload[key]
        if (key === "version" && actualValue === undefined && payload.current_version !== undefined) {
          actualValue = payload.current_version
        }
        if (key === "rights_status" && typeof actualValue === "string") {
          actualValue = actualValue.toUpperCase()
        }
        if (actualValue !== expectedValue) throw new Error(`EVIDENCE_BINDING_MISMATCH:${key}:${String(actualValue)}:${String(expectedValue)}`)
      }
      if (binding.ref.kind === "SYNTHETIC_RIGHTS" && input.asset.rights_status === "VERIFIED_LICENSE" && (typeof payload.license_scope !== "string" || payload.license_scope.trim() === "")) throw new Error("LICENSE_SCOPE_REQUIRED")
      const existingByKind = evidenceRows.filter((row: any) => row.kind === binding.ref.kind)
      const existing = existingByKind.find((row: any) => row.evidence_id === binding.ref.evidence_id)
      const expected = { evidence_id: binding.ref.evidence_id, evidence_key: `${input.run_id}:${binding.ref.kind}`, evidence_sha256: binding.ref.evidence_sha256, payload_sha256: binding.ref.payload_sha256, kind: binding.ref.kind, ...binding.metadata, run_id: input.run_id, synthetic_only: true, provenance }
      if (existing) {
        const fields = ["evidence_id", "evidence_key", "evidence_sha256", "payload_sha256", "kind", "run_id", "source_path", "order_id", "payment_collection_id", "currency_code", "amount", "product_id", "version", "terms_sha256", "payment_snapshot_sha256", "synthetic_only", "provenance"]
        const mismatches = fields.filter((field) => !same(existing[field], (expected as any)[field]))
        if (mismatches.length) throw new Error(`EVIDENCE_CONFLICT:${mismatches.join(",")}`)
      } else {
        if (existingByKind.length) throw new Error("EVIDENCE_KIND_CONFLICT")
        await this.createEvidence(expected, context)
      }
    }

    const [storedAsset] = await list(this, "listJoviAssets", { asset_id: input.asset.asset_id }, context)
    const expectedAsset = { ...normalizedAsset, medusa_product_id: input.medusa_product_id, medusa_variant_id: input.medusa_variant_id, rights_evidence_sha256: input.rights_evidence.evidence_sha256 }
    const asset = storedAsset ?? await this.createAsset(expectedAsset, context)
    const assetFields = ["asset_id", "version", "rights_status", "manifest_sha256", "package_files", "medusa_product_id", "medusa_variant_id", "rights_evidence_sha256"]
    const storedProvenance = storedAsset?.provenance ? { ...storedAsset.provenance, test_run_id: undefined } : undefined
    const expectedProvenance = { ...expectedAsset.provenance, test_run_id: undefined }
    if (storedAsset && (!assetFields.every((field) => same(storedAsset[field], (expectedAsset as any)[field])) || !same(storedProvenance, expectedProvenance))) throw new Error("ASSET_CONFLICT")

    const expectedEntitlement = issueEntitlement(input.order_id, input.payment_evidence, normalizedAsset, input.run_id, input.terms_sha256)
    const expectedReceipt = prepareDigitalDelivery(expectedEntitlement, normalizedAsset, input.run_id, input.package_manifest_sha256)
    const [storedEntitlement] = await list(this, "listJoviEntitlements", { run_id: input.run_id }, context)
    const entitlement = storedEntitlement ?? await this.createEntitlement({ ...expectedEntitlement, issued_at: new Date(expectedEntitlement.issued_at) }, context)
    if (storedEntitlement && !["entitlement_id", "order_id", "product_id", "version", "license_type", "terms_sha256", "payment_evidence_sha256", "run_id", "provenance"].every((field) => same(storedEntitlement[field], (expectedEntitlement as any)[field]))) throw new Error("ENTITLEMENT_CONFLICT")

    if (process.env.NODE_ENV === "test" && process.env.JOVI_TEST_FAILURE_POINT === "before-receipt") {
      delete process.env.JOVI_TEST_FAILURE_POINT
      throw new Error("INJECTED_RECEIPT_FAILURE")
    }
    if (process.env.NODE_ENV === "test" && process.env.JOVI_TEST_FAILURE_POINT === "kill-before-receipt") process.kill(process.pid, "SIGKILL")
    const [storedReceipt] = await list(this, "listJoviDeliveryReceipts", { run_id: input.run_id }, context)
    const receipt = storedReceipt ?? await this.createReceipt(expectedReceipt, context)
    if (storedReceipt && !["delivery_id", "order_id", "entitlement_id", "status", "package_manifest_sha256", "auto_send", "provenance", "run_id"].every((field) => same(storedReceipt[field], (expectedReceipt as any)[field]))) throw new Error("RECEIPT_CONFLICT")
    if (process.env.NODE_ENV === "test" && process.env.JOVI_TEST_FAILURE_POINT === "kill-after-receipt") process.kill(process.pid, "SIGKILL")

    const finalRun = wasReady ? run : await this.updateRun({ id: run.id, state: "READY_FOR_HUMAN_DELIVERY", error_code: null }, context)
    return {
      run: project(finalRun, ["run_id", "intent_sha256", "state", "order_id", "payment_collection_id", "product_id", "variant_id", "environment", "source_fixture_sha256", "synthetic_only", "real_commerce_pilot_started", "provenance", "payment_snapshot_sha256", "error_code"]),
      entitlement: project(entitlement, ["entitlement_id", "order_id", "product_id", "version", "license_type", "terms_sha256", "payment_evidence_sha256", "run_id", "provenance", "issued_at"]),
      receipt: project(receipt, ["delivery_id", "order_id", "entitlement_id", "status", "package_manifest_sha256", "auto_send", "provenance", "run_id"]),
      asset: project(asset, ["asset_id", "version", "rights_status", "manifest_sha256", "package_files", "medusa_product_id", "medusa_variant_id", "provenance", "rights_evidence_sha256"]),
    }
  }

  private createRun(data: any, context: Context) { return super.createJoviRuns(data, context) }
  private updateRun(data: any, context: Context) { return super.updateJoviRuns(data, context) }
  private createEvidence(data: any, context: Context) { return super.createJoviEvidences(data, context) }
  private createAsset(data: any, context: Context) { return super.createJoviAssets(data, context) }
  private createEntitlement(data: any, context: Context) { return super.createJoviEntitlements(data, context) }
  private createReceipt(data: any, context: Context) { return super.createJoviDeliveryReceipts(data, context) }
}

const JOVI_COMMERCE_MODULE_NAME = "joviCommerce"

export const buildSyntheticLockKey = (_runId: string, orderId: string) => `jovi:x2:order:${orderId}`
export { validateSyntheticCore }

type SyntheticCoreInput = SyntheticIssuanceInput

const validateCoreStep = createStep("validate-core", async (input: SyntheticCoreInput, { container }) => {
  const payment = container.resolve(Modules.PAYMENT)
  const order = container.resolve(Modules.ORDER)
  return new StepResponse(await validateSyntheticCore({ payment, order }, input))
})

const persistStep = createStep("persist", async (input: SyntheticCoreInput & { payment_status: string }, { container, context, transactionId }) => {
  const service = container.resolve(JOVI_COMMERCE_MODULE_NAME) as JoviCommerceModuleService
  const workflowTransactionId = transactionId ?? context.transactionId
  if (!workflowTransactionId) throw new Error("WORKFLOW_TRANSACTION_ID_REQUIRED")
  const { payment_status: _paymentStatus, provider_id: _providerId, order_verified: _orderVerified, payment_snapshot_sha256: _snapshot, ...request } = input as any
  const result = await service.runSyntheticIssuance(request, mintWorkflowCapability(), { ...context, transactionId: workflowTransactionId, runId: input.run_id })
  return new StepResponse(result)
})

const acquireSyntheticLockStep = createStep("acquire-synthetic-lock", async (input: { run_id: string; order_id: string }, { container, transactionId }) => {
  const locking = container.resolve(Modules.LOCKING) as any
  const key = buildSyntheticLockKey(input.run_id, input.order_id)
  if (!transactionId) throw new Error("WORKFLOW_TRANSACTION_ID_REQUIRED")
  const ownerId = transactionId
  const deadline = Date.now() + 120_000
  while (true) {
    try {
      await locking.acquire(key, { provider: "locking-redis", ownerId, expire: 60 })
      return new StepResponse({ key, ownerId }, { key, ownerId })
    } catch (error) {
      if (Date.now() >= deadline) throw error
      await wait(500)
    }
  }
}, async (input: { key: string; ownerId: string }, { container }) => {
  const locking = container.resolve(Modules.LOCKING) as any
  await locking.release(input.key, { provider: "locking-redis", ownerId: input.ownerId })
})

const releaseSyntheticLockStep = createStep("release-synthetic-lock", async (input: { key: string; ownerId: string }, { container }) => {
  const locking = container.resolve(Modules.LOCKING) as any
  await locking.release(input.key, { provider: "locking-redis", ownerId: input.ownerId })
  return new StepResponse(true)
})

export const joviSyntheticX2Workflow = createWorkflow({ name: "jovi-synthetic-x2", store: true, retentionTime: 604800 }, (input: SyntheticCoreInput) => {
  const lock = acquireSyntheticLockStep({ run_id: input.run_id, order_id: input.order_id })
  const verified = validateCoreStep(input)
  const result = persistStep(verified)
  releaseSyntheticLockStep(lock)
  return new WorkflowResponse(result)
})

export default JoviCommerceModuleService

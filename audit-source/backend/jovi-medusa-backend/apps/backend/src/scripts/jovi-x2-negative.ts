import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { confirmManualPayment } from "../modules/jovi-commerce/policy-command"
import { JOVI_COMMERCE_MODULE } from "../modules/jovi-commerce"
import { joviSyntheticX2Workflow, validateSyntheticCore } from "../workflows/jovi-x2"

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")

export default async function runNegativeX2({ container }: ExecArgs) {
  const jovi = container.resolve(JOVI_COMMERCE_MODULE) as any
  const orderModule = container.resolve(Modules.ORDER)
  const paymentModule = container.resolve(Modules.PAYMENT)
  const [run] = await jovi.listJoviRuns({})
  const [asset] = await jovi.listJoviAssets({ asset_id: "synthetic-digital-checklist" })
  const evidences = await jovi.listJoviEvidences({ run_id: run.run_id })
  const [entitlement] = await jovi.listJoviEntitlements({ run_id: run.run_id })
  const order = await orderModule.retrieveOrder(run.order_id, { relations: ["items", "items.item", "summary"] })
  const payment = await paymentModule.retrievePaymentCollection(run.payment_collection_id, { relations: ["payment_sessions"] })
  const fixtureRoot = resolve(process.env.JOVI_FIXTURE_ROOT ?? join(process.cwd(), "..", "..", "tests", "fixtures", "synthetic-digital-checklist"))
  const evidenceRoot = resolve(process.env.JOVI_X2_EVIDENCE_ROOT ?? join(process.cwd(), "runtime", "evidence"))
  const paymentContent = await readFile(join(evidenceRoot, run.run_id, "payment-evidence.json"), "utf8")
  const rightsContent = await readFile(join(fixtureRoot, "product.json"), "utf8")
  const packageManifest = await readFile(join(evidenceRoot, run.run_id, "package", "package_manifest.json"))
  const baseInput: any = {
    run_id: run.run_id,
    order_id: run.order_id,
    payment_collection_id: run.payment_collection_id,
    payment_evidence: { ...evidences.find((item: any) => item.kind === "SYNTHETIC_PAYMENT"), content: paymentContent },
    rights_evidence: { ...evidences.find((item: any) => item.kind === "SYNTHETIC_RIGHTS"), content: rightsContent },
    asset: { ...asset },
    medusa_product_id: run.product_id,
    medusa_variant_id: run.variant_id,
    currency_code: order.currency_code,
    amount: Number(order.total).toFixed(2),
    terms_sha256: entitlement.terms_sha256,
    source_fixture_path: "tests/fixtures/synthetic-digital-checklist",
    package_manifest_sha256: sha256(packageManifest),
  }

  const counts = async () => ({ runs: (await jovi.listJoviRuns({})).length, evidences: (await jovi.listJoviEvidences({})).length, assets: (await jovi.listJoviAssets({})).length, entitlements: (await jovi.listJoviEntitlements({})).length, receipts: (await jovi.listJoviDeliveryReceipts({})).length })
  const before = await counts()
  const results: Record<string, { rejected: boolean; error: string }> = {}
  const runCase = async (name: string, action: () => Promise<unknown> | unknown) => {
    try { await action(); results[name] = { rejected: false, error: "NONE" } } catch (error: any) { results[name] = { rejected: true, error: String(error?.message ?? error) } }
  }

  await runCase("caller_supplied_payment_fact", () => joviSyntheticX2Workflow(container).run({ input: { ...baseInput, payment_verified: true }, context: { transactionId: `${run.run_id}-negative-payment-fact`, runId: run.run_id } }))
  await runCase("fixture_source_escape", () => joviSyntheticX2Workflow(container).run({ input: { ...baseInput, source_fixture_path: "tests/fixtures/escape" }, context: { transactionId: `${run.run_id}-negative-source`, runId: run.run_id } }))
  await runCase("manual_payment_command", () => confirmManualPayment(run.order_id, "evidence"))

  const fakeOrder: any = { id: run.order_id, currency_code: "cny", total: 19.9, metadata: { environment: "SYNTHETIC_X2", test_run_id: run.run_id, source_fixture_sha256: asset.provenance.source_fixture_sha256 }, canceled_at: null, items: [{ variant_id: run.variant_id, quantity: 1, unit_price: 19.9 }] }
  const fakePayment: any = { id: run.payment_collection_id, status: "completed", provider_id: "pp_system", currency_code: "cny", amount: 19.9, metadata: { order_id: run.order_id, environment: "SYNTHETIC_X2", test_run_id: run.run_id, source_fixture_sha256: asset.provenance.source_fixture_sha256, product_id: asset.asset_id, version: asset.version, amount: "19.90", currency_code: "cny" } }
  await runCase("payment_amount_mismatch", () => validateSyntheticCore({ payment: { retrievePaymentCollection: async () => ({ ...fakePayment, amount: 20 }) }, order: { retrieveOrder: async () => fakeOrder } }, baseInput))
  await runCase("payment_provider_mismatch", () => validateSyntheticCore({ payment: { retrievePaymentCollection: async () => ({ ...fakePayment, provider_id: "pp_stripe" }) }, order: { retrieveOrder: async () => fakeOrder } }, baseInput))
  await runCase("payment_currency_mismatch", () => validateSyntheticCore({ payment: { retrievePaymentCollection: async () => ({ ...fakePayment, currency_code: "usd" }) }, order: { retrieveOrder: async () => fakeOrder } }, baseInput))

  const after = await counts()
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`NEGATIVE_MUTATED_DATABASE:${JSON.stringify(before)}:${JSON.stringify(after)}`)
  if (Object.values(results).some((result) => !result.rejected)) throw new Error(`NEGATIVE_CASE_ACCEPTED:${JSON.stringify(results)}`)
  process.stdout.write(`${JSON.stringify({ before, after, results, database_unchanged: true })}\n`)
}

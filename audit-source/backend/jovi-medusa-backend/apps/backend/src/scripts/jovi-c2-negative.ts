import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import fs from "node:fs"
import { join, resolve } from "node:path"
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { confirmManualPayment } from "../modules/jovi-commerce/policy-command"
import { JOVI_COMMERCE_MODULE } from "../modules/jovi-commerce"
import { joviSyntheticX2Workflow, validateSyntheticCore } from "../workflows/jovi-x2"
import {
  validateDownloadGrantAccess,
  C2DownloadGrant,
  hashGrantToken,
} from "../modules/jovi-commerce/c2-domain"

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")

export default async function runNegativeC2({ container }: ExecArgs) {
  const jovi = container.resolve(JOVI_COMMERCE_MODULE) as any
  const orderModule = container.resolve(Modules.ORDER)
  const paymentModule = container.resolve(Modules.PAYMENT)

  const runs = await jovi.listJoviRuns({})
  const c2Runs = runs.filter((r: any) => r.environment === "SYNTHETIC_C2")
  const run = c2Runs[0] ?? runs[0]

  const assets = await jovi.listJoviAssets({ asset_id: "SYNTH-C2-VALIDATION-PACK" })
  const asset = assets[0]
  const evidences = await jovi.listJoviEvidences({ run_id: run.run_id })
  const entitlements = await jovi.listJoviEntitlements({ run_id: run.run_id })
  const entitlement = entitlements[0]
  const receipts = await jovi.listJoviDeliveryReceipts({ run_id: run.run_id })
  const receipt = receipts[0]

  const order = await orderModule.retrieveOrder(run.order_id, { relations: ["items", "items.item", "summary"] })
  const payment = await paymentModule.retrievePaymentCollection(run.payment_collection_id, { relations: ["payment_sessions"] })

  const baseEvidenceDir =
    process.env.JOVI_C2_EVIDENCE_ROOT ||
    process.env.JOVI_X2_EVIDENCE_ROOT ||
    resolve(process.cwd(), "runtime", "evidence")

  const candidates = [
    process.env.JOVI_C2_FIXTURE_ROOT,
    resolve(process.cwd(), "governance/c2/reference/fixture"),
    resolve("/workspace/governance/c2/reference/fixture"),
    resolve(process.cwd(), "../../governance/c2/reference/fixture"),
    resolve("/r2-tests/fixtures/c2-synthetic-digital-pack"),
  ].filter(Boolean) as string[]
  const fixtureRoot = candidates.find((c) => fs.existsSync(join(c, "product-manifest.json"))) || candidates[0]

  const paymentContent = await readFile(join(baseEvidenceDir, run.run_id, "payment-evidence.json"), "utf8")
  const rightsContent = await readFile(join(fixtureRoot, "product-manifest.json"), "utf8")

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
    source_fixture_path: "tests/fixtures/c2-synthetic-digital-pack",
    package_manifest_sha256: receipt.package_manifest_sha256,
  }

  const counts = async () => ({
    runs: (await jovi.listJoviRuns({})).length,
    evidences: (await jovi.listJoviEvidences({})).length,
    assets: (await jovi.listJoviAssets({})).length,
    entitlements: (await jovi.listJoviEntitlements({})).length,
    receipts: (await jovi.listJoviDeliveryReceipts({})).length,
  })

  const before = await counts()
  const results: Record<string, { rejected: boolean; error: string }> = {}
  const runCase = async (name: string, action: () => Promise<unknown> | unknown) => {
    try {
      await action()
      results[name] = { rejected: false, error: "NONE" }
    } catch (error: any) {
      results[name] = { rejected: true, error: String(error?.message ?? error) }
    }
  }

  await runCase("caller_supplied_payment_fact", () =>
    joviSyntheticX2Workflow(container).run({
      input: { ...baseInput, payment_verified: true },
      context: { transactionId: `${run.run_id}-neg-payment-fact`, runId: run.run_id },
    })
  )
  await runCase("fixture_source_escape", () =>
    joviSyntheticX2Workflow(container).run({
      input: { ...baseInput, source_fixture_path: "tests/fixtures/escape" },
      context: { transactionId: `${run.run_id}-neg-source`, runId: run.run_id },
    })
  )
  await runCase("manual_payment_command", () => confirmManualPayment(run.order_id, "evidence"))

  const fakeOrder: any = {
    id: run.order_id,
    currency_code: "cny",
    total: 29.9,
    metadata: {
      environment: "SYNTHETIC_C2",
      test_run_id: run.run_id,
      source_fixture_sha256: asset.provenance.source_fixture_sha256,
    },
    canceled_at: null,
    items: [{ variant_id: run.variant_id, quantity: 1, unit_price: 29.9 }],
  }
  const fakePayment: any = {
    id: run.payment_collection_id,
    status: "completed",
    provider_id: "pp_system",
    currency_code: "cny",
    amount: 29.9,
    metadata: {
      order_id: run.order_id,
      environment: "SYNTHETIC_C2",
      test_run_id: run.run_id,
      source_fixture_sha256: asset.provenance.source_fixture_sha256,
      product_id: asset.asset_id,
      version: asset.version,
      amount: "29.90",
      currency_code: "cny",
    },
  }

  await runCase("payment_amount_mismatch", () =>
    validateSyntheticCore(
      { payment: { retrievePaymentCollection: async () => ({ ...fakePayment, amount: 50 }) }, order: { retrieveOrder: async () => fakeOrder } },
      baseInput
    )
  )
  await runCase("payment_provider_mismatch", () =>
    validateSyntheticCore(
      { payment: { retrievePaymentCollection: async () => ({ ...fakePayment, provider_id: "pp_stripe" }) }, order: { retrieveOrder: async () => fakeOrder } },
      baseInput
    )
  )
  await runCase("payment_currency_mismatch", () =>
    validateSyntheticCore(
      { payment: { retrievePaymentCollection: async () => ({ ...fakePayment, currency_code: "usd" }) }, order: { retrieveOrder: async () => fakeOrder } },
      baseInput
    )
  )

  // C2 Grant Negative Tests
  const rawToken = "test_token_c2"
  const testGrant: C2DownloadGrant = {
    grant_id: "grant_neg",
    entitlement_id: entitlement.entitlement_id,
    order_id: run.order_id,
    package_id: "pkg_c2",
    token_hash: hashGrantToken(rawToken),
    expires_at: new Date(Date.now() - 1000).toISOString(),
    revoked_at: null,
    synthetic_only: true,
  }

  await runCase("expired_grant", () =>
    validateDownloadGrantAccess({
      grant: testGrant,
      token: rawToken,
      entitlement,
      orderId: run.order_id,
      packageId: "pkg_c2",
    })
  )

  await runCase("revoked_grant", () =>
    validateDownloadGrantAccess({
      grant: { ...testGrant, expires_at: new Date(Date.now() + 60000).toISOString(), revoked_at: new Date().toISOString() },
      token: rawToken,
      entitlement,
      orderId: run.order_id,
      packageId: "pkg_c2",
    })
  )

  await runCase("token_mismatch", () =>
    validateDownloadGrantAccess({
      grant: { ...testGrant, expires_at: new Date(Date.now() + 60000).toISOString() },
      token: "wrong_token",
      entitlement,
      orderId: run.order_id,
      packageId: "pkg_c2",
    })
  )

  const after = await counts()
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`NEGATIVE_MUTATED_DATABASE:${JSON.stringify(before)}:${JSON.stringify(after)}`)
  }
  if (Object.values(results).some((r) => !r.rejected)) {
    throw new Error(`NEGATIVE_CASE_ACCEPTED:${JSON.stringify(results)}`)
  }

  process.stdout.write(`${JSON.stringify({ before, after, results, database_unchanged: true })}\n`)
}

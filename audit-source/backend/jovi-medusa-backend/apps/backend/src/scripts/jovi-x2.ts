import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createOrderWorkflow, createProductsWorkflow, markPaymentCollectionAsPaid } from "@medusajs/medusa/core-flows"
import { buildFixtureManifest, toMedusaMajorUnits } from "../modules/jovi-commerce/fixture"
import { validateAsset, type EvidenceRef, type SyntheticProvenance } from "../modules/jovi-commerce/domain"
import { buildSyntheticPaymentSnapshot, hashSyntheticBinding } from "../modules/jovi-commerce/medusa-binding"
import { buildDeterministicPackage } from "../modules/jovi-commerce/package"
import { JOVI_COMMERCE_MODULE } from "../modules/jovi-commerce"
import { joviSyntheticX2Workflow } from "../workflows/jovi-x2"

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
const canonical = (value: unknown) => Buffer.from(`${JSON.stringify(value, Object.keys(value as object).sort())}\n`)
const fixtureFiles = ["changelog.md", "delivery.json", "faq.md", "pricing.json", "product.json", "version.json", "assets/checklist.txt"]

export function buildSyntheticOutput(input: { product_id: string; variant_id: string; order_id: string; run_id: string; entitlement: unknown; receipt: unknown; provenance: SyntheticProvenance; payment_provider?: string }) {
  return {
    ...input,
    result: "READY_FOR_HUMAN_DELIVERY",
    payment_mode: "synthetic_programmatic_mark_paid",
    payment_provider: input.payment_provider ?? "pp_system",
    environment: input.provenance.environment,
    synthetic_only: true,
    test_run_id: input.run_id,
    source_fixture_sha256: input.provenance.source_fixture_sha256,
    real_commerce_pilot_started: false,
    production_integration_allowed: false,
    external_actions: { stripe: false, webhook: false, email: false, download_url: false, xianyu: false, auto_delivery: false },
  }
}

export default async function joviX2({ container }: ExecArgs) {
  const fixtureRoot = resolve(process.env.JOVI_FIXTURE_ROOT ?? join(process.cwd(), "..", "..", "tests", "fixtures", "synthetic-digital-checklist"))
  const fixtureManifest = await buildFixtureManifest(fixtureRoot, fixtureFiles)
  const productFixture = JSON.parse(await readFile(join(fixtureRoot, "product.json"), "utf8"))
  const pricingFixture = JSON.parse(await readFile(join(fixtureRoot, "pricing.json"), "utf8"))
  const deliveryFixture = JSON.parse(await readFile(join(fixtureRoot, "delivery.json"), "utf8"))
  const versionFixture = JSON.parse(await readFile(join(fixtureRoot, "version.json"), "utf8"))
  if (productFixture.rights_status !== "ORIGINAL" || versionFixture.status !== "RELEASED" || deliveryFixture.license_type !== "SINGLE_USER") throw new Error("FIXTURE_RIGHTS_OR_VERSION_REJECTED")
  const amount = toMedusaMajorUnits(pricingFixture.amount_minor, pricingFixture.currency)
  const testRunId = process.env.NODE_ENV === "test" && /^x2_[0-9a-f]{16,64}$/.test(process.env.JOVI_TEST_RUN_ID ?? "") ? process.env.JOVI_TEST_RUN_ID! : `x2_${fixtureManifest.manifest_sha256.slice(0, 16)}`
  const provenance: SyntheticProvenance = { environment: "SYNTHETIC_X2", synthetic_only: true, test_run_id: testRunId, source_fixture_sha256: fixtureManifest.manifest_sha256, real_commerce_pilot_started: false }
  const productModule = container.resolve(Modules.PRODUCT)
  const orderModule = container.resolve(Modules.ORDER)
  const paymentModule = container.resolve(Modules.PAYMENT)
  const joviCommerce = container.resolve(JOVI_COMMERCE_MODULE) as any
  const query = container.resolve("query")
  const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
  const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  if (!regions[0] || !channels[0]) throw new Error("SPIKE_BASELINE_MISSING")

  let product = (await productModule.listProducts({ handle: productFixture.product_id }, { relations: ["variants"] }))[0]
  if (!product) {
    const created = await createProductsWorkflow(container).run({ input: { products: [{ title: productFixture.name, handle: productFixture.product_id, status: "published", options: [{ title: "Version", values: [productFixture.current_version] }], variants: [{ title: `Version ${productFixture.current_version}`, sku: `JOVI-${productFixture.product_id}-${productFixture.current_version}`, manage_inventory: false, options: { Version: productFixture.current_version }, prices: [{ currency_code: pricingFixture.currency.toLowerCase(), amount }] }] }] } })
    product = created.result[0]
  }
  const detailed = await productModule.retrieveProduct(product.id, { relations: ["variants"] })
  const variant = detailed.variants?.[0]
  if (!variant) throw new Error("SPIKE_VARIANT_MISSING")
  const priorOrders = await orderModule.listOrders({}, { take: 100, select: ["id", "metadata"] })
  let order = priorOrders.find((candidate: any) => candidate.metadata?.test_run_id === provenance.test_run_id)
  if (!order) {
   const created = await createOrderWorkflow(container).run({ input: { region_id: regions[0].id, sales_channel_id: channels[0].id, status: "pending", email: "synthetic@example.invalid", metadata: { ...provenance, product_id: productFixture.product_id, version: productFixture.current_version, amount, currency_code: pricingFixture.currency.toLowerCase() }, items: [{ variant_id: variant.id, quantity: 1, title: detailed.title, unit_price: amount }] } })
    order = created.result
    const collection = await paymentModule.createPaymentCollections({ currency_code: pricingFixture.currency.toLowerCase(), amount, metadata: { order_id: order.id, product_id: productFixture.product_id, version: productFixture.current_version, amount, currency_code: pricingFixture.currency.toLowerCase(), ...provenance } })
    await markPaymentCollectionAsPaid(container).run({ input: { order_id: order.id, payment_collection_id: collection.id } })
  }
  const paymentCollections = await paymentModule.listPaymentCollections({}, { take: 100 })
  const paymentCollection = paymentCollections.find((candidate: any) => candidate.metadata?.order_id === order.id)
  if (!paymentCollection) throw new Error("SPIKE_PAYMENT_COLLECTION_MISSING")
  const provider = (paymentCollection as any).provider_id ?? (paymentCollection as any).payment_sessions?.[0]?.provider_id ?? "pp_system_default"
  const paymentSnapshotSha256 = hashSyntheticBinding(buildSyntheticPaymentSnapshot(paymentCollection, await orderModule.retrieveOrder(order.id, { relations: ["items", "items.item", "summary"] }), { medusa_variant_id: variant.id } as any, provider))
  const paymentEvidenceBytes = canonical({ amount, currency: pricingFixture.currency.toLowerCase(), mode: "synthetic_programmatic_mark_paid", order_id: order.id, payment_collection_id: paymentCollection.id, product_id: productFixture.product_id, run_id: provenance.test_run_id, version: productFixture.current_version, payment_snapshot_sha256: paymentSnapshotSha256 })
  const evidenceRoot = join(process.env.JOVI_X2_EVIDENCE_ROOT ?? join(process.cwd(), "runtime", "evidence"), provenance.test_run_id)
  await mkdir(evidenceRoot, { recursive: true })
  await writeFile(join(evidenceRoot, "payment-evidence.json"), paymentEvidenceBytes)
  const digitalPackage = await buildDeterministicPackage(fixtureRoot, deliveryFixture.package_files, join(evidenceRoot, "package"), fixtureManifest.manifest_sha256)
  const paymentEvidence: EvidenceRef = { evidence_id: `payment_${provenance.test_run_id}`, evidence_sha256: sha256(paymentEvidenceBytes), kind: "SYNTHETIC_PAYMENT", payload_sha256: sha256(paymentEvidenceBytes), content: paymentEvidenceBytes.toString("utf8") }
  const rightsEntry = fixtureManifest.entries.find((entry) => entry.path === "product.json")!
  const rightsContent = await readFile(join(fixtureRoot, rightsEntry.path), "utf8")
  const rightsEvidence: EvidenceRef = { evidence_id: `rights_${provenance.test_run_id}`, evidence_sha256: rightsEntry.sha256, kind: "SYNTHETIC_RIGHTS", payload_sha256: rightsEntry.sha256, content: rightsContent }
  const asset = validateAsset({ asset_id: productFixture.product_id, version: productFixture.current_version, rights_status: productFixture.rights_status, manifest_sha256: fixtureManifest.manifest_sha256, package_files: deliveryFixture.package_files, provenance, rights_evidence_sha256: rightsEvidence.evidence_sha256 })
  const transactionId = process.env.NODE_ENV === "test" && process.env.JOVI_TEST_TRANSACTION_ID ? process.env.JOVI_TEST_TRANSACTION_ID : provenance.test_run_id
  const result = await joviSyntheticX2Workflow(container).run({ input: { run_id: provenance.test_run_id, order_id: order.id, payment_collection_id: paymentCollection.id, payment_evidence: paymentEvidence, rights_evidence: rightsEvidence, asset, medusa_product_id: product.id, medusa_variant_id: variant.id, currency_code: pricingFixture.currency.toLowerCase(), amount, terms_sha256: versionFixture.product_id === productFixture.product_id ? rightsEntry.sha256 : "", source_fixture_path: "tests/fixtures/synthetic-digital-checklist", package_manifest_sha256: digitalPackage.package_manifest_sha256 }, context: { transactionId, runId: provenance.test_run_id } })
  const output: any = result.result
  process.stdout.write(`${JSON.stringify({ ...buildSyntheticOutput({ product_id: product.id, variant_id: variant.id, order_id: order.id, run_id: provenance.test_run_id, entitlement: output.entitlement, receipt: output.receipt, provenance, payment_provider: provider }), package_path: digitalPackage.package_path, package_sha256: digitalPackage.package_sha256, package_manifest_sha256: digitalPackage.package_manifest_sha256 })}\n`)
}

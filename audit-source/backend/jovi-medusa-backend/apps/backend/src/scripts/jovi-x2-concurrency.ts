import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { JOVI_COMMERCE_MODULE } from "../modules/jovi-commerce"
import { joviSyntheticX2Workflow } from "../workflows/jovi-x2"

export default async function runConcurrentX2({ container }: ExecArgs) {
  const jovi = container.resolve(JOVI_COMMERCE_MODULE) as any
  const orderModule = container.resolve(Modules.ORDER)
  const paymentModule = container.resolve(Modules.PAYMENT)
  const [run] = await jovi.listJoviRuns({})
  const [asset] = await jovi.listJoviAssets({ asset_id: "synthetic-digital-checklist" })
  const evidences = await jovi.listJoviEvidences({ run_id: run.run_id })
  const [entitlement] = await jovi.listJoviEntitlements({ run_id: run.run_id })
  const order = await orderModule.retrieveOrder(run.order_id, { relations: ["items", "items.item", "summary"] })
  const payment = await paymentModule.retrievePaymentCollection(run.payment_collection_id, { relations: ["payment_sessions"] })
  const paymentEvidence = evidences.find((item: any) => item.kind === "SYNTHETIC_PAYMENT")
  const rightsEvidence = evidences.find((item: any) => item.kind === "SYNTHETIC_RIGHTS")
  if (!run || !asset || !paymentEvidence || !rightsEvidence || !entitlement || !order || !payment) throw new Error("CONCURRENCY_BASELINE_MISSING")
  const fixtureRoot = resolve(process.env.JOVI_FIXTURE_ROOT ?? join(process.cwd(), "..", "..", "tests", "fixtures", "synthetic-digital-checklist"))
  const evidenceRoot = resolve(process.env.JOVI_X2_EVIDENCE_ROOT ?? join(process.cwd(), "runtime", "evidence"))
  const paymentContent = await readFile(join(evidenceRoot, run.run_id, "payment-evidence.json"), "utf8")
  const rightsContent = await readFile(join(fixtureRoot, "product.json"), "utf8")
  const packageManifestBytes = await readFile(join(evidenceRoot, run.run_id, "package", "package_manifest.json"))
  const packageManifestSha256 = createHash("sha256").update(packageManifestBytes).digest("hex")
  const input = {
    run_id: run.run_id,
    order_id: run.order_id,
    payment_collection_id: run.payment_collection_id,
    payment_evidence: { evidence_id: paymentEvidence.evidence_id, evidence_sha256: paymentEvidence.evidence_sha256, kind: paymentEvidence.kind, payload_sha256: paymentEvidence.payload_sha256, content: paymentContent },
    rights_evidence: { evidence_id: rightsEvidence.evidence_id, evidence_sha256: rightsEvidence.evidence_sha256, kind: rightsEvidence.kind, payload_sha256: rightsEvidence.payload_sha256, content: rightsContent },
    asset: { asset_id: asset.asset_id, version: asset.version, rights_status: asset.rights_status, manifest_sha256: asset.manifest_sha256, package_files: asset.package_files, provenance: asset.provenance, rights_evidence_sha256: asset.rights_evidence_sha256 },
    medusa_product_id: run.product_id,
    medusa_variant_id: run.variant_id,
    currency_code: order.currency_code,
    amount: Number(order.total).toFixed(2),
    terms_sha256: entitlement.terms_sha256,
    source_fixture_path: "tests/fixtures/synthetic-digital-checklist",
    package_manifest_sha256: packageManifestSha256,
  }
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => joviSyntheticX2Workflow(container).run({ input, context: { transactionId: `${run.run_id}-${index}`, runId: run.run_id } })))
  const ids = results.map((result: any) => [result.result.entitlement.entitlement_id, result.result.receipt.delivery_id])
  if (new Set(ids.map((id: string[]) => id.join("|"))).size !== 1) throw new Error("CONCURRENCY_DUPLICATE_RESULT")
  process.stdout.write(`${JSON.stringify({ runs: results.length, unique_results: 1, run_id: run.run_id, state: results[0].result.run.state })}\n`)
}

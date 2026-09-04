import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVI_COMMERCE_MODULE } from "../../../../modules/jovi-commerce"
import fs from "node:fs"
import path from "node:path"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: any = req.scope.resolve(JOVI_COMMERCE_MODULE)
  const runs = await service.listJoviRuns({}, {})
  const entitlements = await service.listJoviEntitlements({}, {})
  const receipts = await service.listJoviDeliveryReceipts({}, {})

  const baseEvidenceDir =
    process.env.JOVI_C2_EVIDENCE_ROOT ||
    process.env.JOVI_X2_EVIDENCE_ROOT ||
    path.resolve(process.cwd(), "runtime/evidence")

  let draftBundle = null
  const draftPath = path.join(baseEvidenceDir, "xianyu_draft_bundle.json")
  if (fs.existsSync(draftPath)) {
    try {
      draftBundle = JSON.parse(fs.readFileSync(draftPath, "utf8"))
    } catch {}
  }

  return res.json({
    synthetic_only: true,
    production_integration_allowed: false,
    real_payment: false,
    real_customer: false,
    xianyu: false,
    auto_delivery: false,
    n8n_production: false,
    runs_count: runs.length,
    entitlements_count: entitlements.length,
    receipts_count: receipts.length,
    draft_bundle_present: Boolean(draftBundle),
    latest_run: runs[0] ?? null,
  })
}

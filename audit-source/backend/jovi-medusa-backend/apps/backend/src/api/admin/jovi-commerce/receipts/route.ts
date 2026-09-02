import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVI_COMMERCE_MODULE } from "../../../../modules/jovi-commerce"

/**
 * Read-only Admin endpoint used by the interactive Admin browser smoke (Gap L1).
 *
 * GET /admin/jovi-commerce/receipts?run_id=<run_id>
 *
 * - Returns synthetic-only run / entitlement / delivery receipt projections.
 * - Read-only: only uses generated list methods; no mutation is performed.
 * - Inherits Medusa's default /admin authentication (session / bearer / api-key);
 *   unauthenticated requests are rejected by the Admin boundary.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const runId = String(req.query.run_id ?? "").trim()
  if (!runId) {
    return res.status(400).json({ error: "RUN_ID_REQUIRED" })
  }

  const service: any = req.scope.resolve(JOVI_COMMERCE_MODULE)
  const [run] = await service.listJoviRuns({ run_id: runId }, {})
  const entitlements = await service.listJoviEntitlements({ run_id: runId }, {})
  const receipts = await service.listJoviDeliveryReceipts({ run_id: runId }, {})

  return res.json({
    run_id: runId,
    synthetic_only: true,
    production_integration_allowed: false,
    run: run
      ? {
          run_id: run.run_id,
          state: run.state,
          order_id: run.order_id,
          product_id: run.product_id,
          environment: run.environment,
          synthetic_only: run.synthetic_only,
          real_commerce_pilot_started: run.real_commerce_pilot_started,
          provenance: run.provenance,
        }
      : null,
    entitlements: entitlements.map((row: any) => ({
      entitlement_id: row.entitlement_id,
      order_id: row.order_id,
      product_id: row.product_id,
      version: row.version,
      license_type: row.license_type,
      terms_sha256: row.terms_sha256,
      payment_evidence_sha256: row.payment_evidence_sha256,
      run_id: row.run_id,
      provenance: row.provenance,
    })),
    receipts: receipts.map((row: any) => ({
      delivery_id: row.delivery_id,
      order_id: row.order_id,
      entitlement_id: row.entitlement_id,
      status: row.status,
      package_manifest_sha256: row.package_manifest_sha256,
      auto_send: row.auto_send,
      run_id: row.run_id,
      provenance: row.provenance,
    })),
  })
}

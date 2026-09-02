import { model } from "@medusajs/framework/utils"

const JoviEvidence = model.define("jovi_evidence", {
  id: model.id().primaryKey(),
  evidence_id: model.text().unique(),
  evidence_key: model.text().unique(),
  run_id: model.text(),
  evidence_sha256: model.text(),
  payload_sha256: model.text(),
  kind: model.enum(["SYNTHETIC_PAYMENT", "SYNTHETIC_RIGHTS"]),
  source_path: model.text(),
  order_id: model.text().nullable(),
  payment_collection_id: model.text().nullable(),
  currency_code: model.text().nullable(),
  amount: model.text().nullable(),
  product_id: model.text().nullable(),
  version: model.text().nullable(),
  terms_sha256: model.text().nullable(),
  payment_snapshot_sha256: model.text().nullable(),
  provenance: model.json().nullable(),
  synthetic_only: model.boolean(),
})

export default JoviEvidence

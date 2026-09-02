import { model } from "@medusajs/framework/utils"
import type { SyntheticProvenance } from "../domain"

const JoviRun = model.define("jovi_run", {
  id: model.id().primaryKey(),
  run_id: model.text().unique(),
  intent_sha256: model.text(),
  state: model.enum(["RECOVERY_PENDING", "READY_FOR_HUMAN_DELIVERY", "FAILED"]),
  order_id: model.text().unique(),
  payment_collection_id: model.text().unique(),
  product_id: model.text(),
  variant_id: model.text(),
  environment: model.enum(["SYNTHETIC_X2"]),
  source_fixture_sha256: model.text(),
  synthetic_only: model.boolean(),
  real_commerce_pilot_started: model.boolean(),
  provenance: model.json<SyntheticProvenance>(),
  payment_snapshot_sha256: model.text(),
  error_code: model.text().nullable(),
})

export default JoviRun

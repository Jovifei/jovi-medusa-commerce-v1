import { model } from "@medusajs/framework/utils"
import type { SyntheticProvenance } from "../domain"

const JoviEntitlement = model.define("jovi_entitlement", {
  id: model.id().primaryKey(),
  entitlement_id: model.text().unique(),
  order_id: model.text().unique(),
  product_id: model.text(),
  version: model.text(),
  license_type: model.enum(["SINGLE_USER"]),
  terms_sha256: model.text(),
  payment_evidence_sha256: model.text(),
  run_id: model.text().unique(),
  provenance: model.json<SyntheticProvenance>(),
  issued_at: model.dateTime(),
})

export default JoviEntitlement

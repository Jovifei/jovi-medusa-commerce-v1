import { model } from "@medusajs/framework/utils"
import type { SyntheticProvenance } from "../domain"

const JoviDeliveryReceipt = model.define("jovi_delivery_receipt", {
  id: model.id().primaryKey(),
  delivery_id: model.text().unique(),
  order_id: model.text().unique(),
  entitlement_id: model.text().unique(),
  status: model.enum(["READY_FOR_HUMAN_DELIVERY"]),
  package_manifest_sha256: model.text(),
  auto_send: model.boolean().default(false),
  provenance: model.json<SyntheticProvenance>(),
  run_id: model.text().unique(),
})

export default JoviDeliveryReceipt

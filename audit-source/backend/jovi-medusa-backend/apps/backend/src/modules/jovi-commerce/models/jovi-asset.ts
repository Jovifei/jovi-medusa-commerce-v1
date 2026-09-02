import { model } from "@medusajs/framework/utils"
import type { SyntheticProvenance } from "../domain"

const JoviAsset = model.define("jovi_asset", {
  id: model.id().primaryKey(),
  asset_id: model.text().unique(),
  version: model.text(),
  rights_status: model.enum(["ORIGINAL", "VERIFIED_LICENSE"]),
  manifest_sha256: model.text(),
  package_files: model.json<string[]>(),
  medusa_product_id: model.text(),
  medusa_variant_id: model.text(),
  provenance: model.json<SyntheticProvenance>(),
  rights_evidence_sha256: model.text(),
})

export default JoviAsset

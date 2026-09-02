import { buildSyntheticLockKey, validateSyntheticCore } from "../jovi-x2"
import { createHash } from "node:crypto"

const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const SHA_A = hash("synthetic-manifest")
const SHA_B = hash("synthetic-source")

const base = {
  run_id: "x2_0123456789abcdef",
  order_id: "order_1",
  payment_collection_id: "pay_1",
  medusa_product_id: "prod_1",
  medusa_variant_id: "variant_1",
  currency_code: "cny",
  amount: "19.90",
  source_fixture_sha256: SHA_B,
  asset: { asset_id: "synthetic-digital-checklist", version: "1.0.0", rights_status: "ORIGINAL", manifest_sha256: SHA_A, rights_evidence_sha256: SHA_B, package_files: ["assets/checklist.txt"], provenance: { environment: "SYNTHETIC_X2", synthetic_only: true, test_run_id: "x2_0123456789abcdef", source_fixture_sha256: SHA_B, real_commerce_pilot_started: false } },
}

describe("synthetic core validation", () => {
  test("scopes the official lock to both run and order", () => {
    expect(buildSyntheticLockKey("x2_0123456789abcdef", "order_1")).toBe("jovi:x2:order:order_1")
  })

  test("binds completed system payment, order amount and variant", async () => {
    const payment = { id: "pay_1", status: "completed", provider_id: "pp_system", currency_code: "cny", amount: 19.9, metadata: { order_id: "order_1", environment: "SYNTHETIC_X2", test_run_id: base.run_id, source_fixture_sha256: base.source_fixture_sha256, product_id: base.asset.asset_id, version: base.asset.version, amount: "19.90", currency_code: "cny" } }
    const order = { id: "order_1", currency_code: "cny", total: 19.9, metadata: { environment: "SYNTHETIC_X2", test_run_id: base.run_id, source_fixture_sha256: base.source_fixture_sha256 }, items: [{ variant_id: "variant_1", quantity: 1, unit_price: 19.9 }], canceled_at: null }
    await expect(validateSyntheticCore({ payment: { retrievePaymentCollection: async () => payment }, order: { retrieveOrder: async () => order } } as never, base as never)).resolves.toMatchObject({ order_id: "order_1", payment_status: "completed" })
  })

  test("rejects wrong amount, provider, order or cancelled order", async () => {
    const wrongAmount = { id: "pay_1", status: "completed", provider_id: "pp_system", currency_code: "cny", amount: 20, metadata: { order_id: "order_1", environment: "SYNTHETIC_X2", test_run_id: base.run_id, source_fixture_sha256: base.source_fixture_sha256, product_id: base.asset.asset_id, version: base.asset.version, amount: "19.90", currency_code: "cny" } }
    const order = { id: "order_1", currency_code: "cny", total: 19.9, metadata: { environment: "SYNTHETIC_X2", test_run_id: base.run_id, source_fixture_sha256: base.source_fixture_sha256 }, items: [{ variant_id: "variant_1", quantity: 1, unit_price: 19.9 }], canceled_at: null }
    await expect(validateSyntheticCore({ payment: { retrievePaymentCollection: async () => wrongAmount }, order: { retrieveOrder: async () => order } } as never, base as never)).rejects.toThrow("PAYMENT_AMOUNT_MISMATCH")
    const correctAmount = { ...wrongAmount, amount: 19.9 }
    const wrongProvider = { ...correctAmount, provider_id: "pp_stripe" }
    await expect(validateSyntheticCore({ payment: { retrievePaymentCollection: async () => wrongProvider }, order: { retrieveOrder: async () => order } } as never, base as never)).rejects.toThrow("PAYMENT_PROVIDER_NOT_ALLOWED")
    await expect(validateSyntheticCore({ payment: { retrievePaymentCollection: async () => correctAmount }, order: { retrieveOrder: async () => ({ ...order, canceled_at: new Date() }) } } as never, base as never)).rejects.toThrow("ORDER_CANCELLED")
  })
})

import { buildSyntheticOutput } from "../../../scripts/jovi-x2"
import { createHash } from "node:crypto"

const SOURCE_SHA = createHash("sha256").update("synthetic-source").digest("hex")

describe("synthetic X2 output contract", () => {
  test("labels every terminal result as synthetic and non-production", () => {
    const result = buildSyntheticOutput({
      product_id: "prod_1",
      variant_id: "variant_1",
      order_id: "order_1",
      run_id: "x2_0123456789abcdef",
      entitlement: { entitlement_id: "ent_1" },
      receipt: { delivery_id: "delivery_1", auto_send: false },
      provenance: {
        environment: "SYNTHETIC_X2",
        synthetic_only: true,
        test_run_id: "x2_0123456789abcdef",
        source_fixture_sha256: SOURCE_SHA,
        real_commerce_pilot_started: false,
      },
    })
    expect(result).toMatchObject({
      result: "READY_FOR_HUMAN_DELIVERY",
      payment_mode: "synthetic_programmatic_mark_paid",
      environment: "SYNTHETIC_X2",
      synthetic_only: true,
      test_run_id: "x2_0123456789abcdef",
      real_commerce_pilot_started: false,
      production_integration_allowed: false,
    })
    expect(Object.values(result.external_actions).every((value) => value === false)).toBe(true)
  })
})

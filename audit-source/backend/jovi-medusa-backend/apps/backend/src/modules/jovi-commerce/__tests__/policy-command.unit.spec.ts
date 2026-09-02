import { confirmManualPayment } from "../policy-command"

describe("synthetic spike payment policy", () => {
  test("rejects the manual payment command without writing state", () => {
    expect(() => confirmManualPayment("order_1", "evidence_sha256")).toThrow("MANUAL_PAYMENT_DISABLED_IN_SYNTHETIC_SPIKE")
  })
})

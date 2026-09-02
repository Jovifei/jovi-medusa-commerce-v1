export function confirmManualPayment(_orderId: string, _evidenceSha256: string): never {
  throw new Error("MANUAL_PAYMENT_DISABLED_IN_SYNTHETIC_SPIKE")
}

import { createHash } from "node:crypto"
import type { SyntheticIssuanceInput } from "./service"

export type VerifiedSyntheticCore = SyntheticIssuanceInput & {
  payment_status: string
  provider_id: string
  order_verified: true
  payment_snapshot_sha256: string
}

const canonical = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  return JSON.stringify(value)
}

export const hashSyntheticBinding = (value: unknown) => createHash("sha256").update(canonical(value), "utf8").digest("hex")

const majorAmount = (value: unknown) => {
  if (value === null || value === undefined) return null
  const normalized = value && typeof value === "object" && "value" in value ? (value as { value: unknown }).value : value
  const direct = Number(normalized)
  const parsed = Number.isFinite(direct) ? direct : Number(String(normalized))
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null
}

const metadata = (value: any) => ({
  environment: value?.environment,
  test_run_id: value?.test_run_id,
  source_fixture_sha256: value?.source_fixture_sha256,
  product_id: value?.product_id,
  version: value?.version,
  amount: value?.amount,
  currency_code: value?.currency_code,
  order_id: value?.order_id,
})

export const buildSyntheticPaymentSnapshot = (payment: any, order: any, input: SyntheticIssuanceInput, provider: string) => {
  const item = (order.items ?? []).find((candidate: any) => (candidate.variant_id ?? candidate.item?.variant_id) === input.medusa_variant_id)
  const orderTotal = order.total ?? order.summary?.totals?.current_order_total ?? order.summary?.totals?.original_order_total
  return {
    schema_version: 1,
    payment_collection: {
      id: payment.id,
      status: payment.status,
      provider_id: provider,
      currency_code: String(payment.currency_code).toLowerCase(),
      amount: majorAmount(payment.amount),
      metadata: metadata(payment.metadata),
    },
    order: {
      id: order.id,
      currency_code: String(order.currency_code).toLowerCase(),
      total: majorAmount(orderTotal),
      canceled_at: order.canceled_at ? new Date(order.canceled_at).toISOString() : null,
      metadata: metadata(order.metadata),
      item: item ? {
        variant_id: item.variant_id ?? item.item?.variant_id,
        quantity: Number(item.quantity ?? item.item?.quantity),
        unit_price: majorAmount(item.unit_price ?? item.item?.unit_price ?? item.item?.raw_unit_price?.value),
      } : null,
    },
  }
}

export async function validateSyntheticCore(dependencies: any, input: SyntheticIssuanceInput): Promise<VerifiedSyntheticCore> {
  if ((input as any).payment_verified !== undefined || (input as any).payment_status !== undefined || (input as any).provider_id !== undefined) throw new Error("PAYMENT_FACTS_MUST_BE_READ_FROM_MEDUSA")
  if (!/^\d+\.\d{2}$/.test(input.amount) || input.currency_code.toLowerCase() !== "cny") throw new Error("INVALID_SYNTHETIC_PRICE")
  const payment = await dependencies.payment.retrievePaymentCollection(input.payment_collection_id, { relations: ["payment_sessions"] })
  const order = await dependencies.order.retrieveOrder(input.order_id, { relations: ["items", "items.item", "summary"] })
  const provider = payment.provider_id ?? payment.payment_sessions?.[0]?.provider_id
  if (!payment || payment.id !== input.payment_collection_id) throw new Error("PAYMENT_COLLECTION_NOT_FOUND")
  if (!provider) throw new Error("PAYMENT_PROVIDER_MISSING")
  if (payment.status !== "completed") throw new Error("PAYMENT_COLLECTION_NOT_COMPLETED")
  if (provider !== "pp_system" && provider !== "pp_system_default") throw new Error("PAYMENT_PROVIDER_NOT_ALLOWED")
  if (payment.metadata?.order_id !== input.order_id) throw new Error("PAYMENT_COLLECTION_ORDER_MISMATCH")
  if (payment.metadata?.environment !== "SYNTHETIC_X2" && payment.metadata?.environment !== "SYNTHETIC_C2") throw new Error("PAYMENT_ENVIRONMENT_MISMATCH")
  if (payment.metadata?.test_run_id !== input.run_id) throw new Error(`PAYMENT_RUN_MISMATCH:${String(payment.metadata?.test_run_id)}:${input.run_id}`)
  if (payment.metadata?.source_fixture_sha256 !== input.asset.provenance.source_fixture_sha256) throw new Error("PAYMENT_FIXTURE_MISMATCH")
  if (payment.metadata?.product_id !== input.asset.asset_id || payment.metadata?.version !== input.asset.version) throw new Error("PAYMENT_PRODUCT_MISMATCH")
  if (payment.metadata?.amount !== input.amount || payment.metadata?.currency_code !== input.currency_code.toLowerCase()) throw new Error("PAYMENT_METADATA_AMOUNT_MISMATCH")
  if (String(payment.currency_code).toLowerCase() !== input.currency_code.toLowerCase()) throw new Error("PAYMENT_CURRENCY_MISMATCH")
  if (majorAmount(payment.amount) !== input.amount) throw new Error("PAYMENT_AMOUNT_MISMATCH")
  if (!order || order.id !== input.order_id || order.canceled_at) throw new Error("ORDER_CANCELLED")
  if ((order.metadata?.environment !== "SYNTHETIC_X2" && order.metadata?.environment !== "SYNTHETIC_C2") || order.metadata?.test_run_id !== input.run_id || order.metadata?.source_fixture_sha256 !== input.asset.provenance.source_fixture_sha256) throw new Error("ORDER_PROVENANCE_MISMATCH")
  const orderTotal = order.total ?? order.summary?.totals?.current_order_total ?? order.summary?.totals?.original_order_total
  const expectedAmount = majorAmount(input.amount)
  if (String(order.currency_code).toLowerCase() !== input.currency_code.toLowerCase() || majorAmount(orderTotal) !== expectedAmount) throw new Error("ORDER_AMOUNT_MISMATCH")
  const item = (order.items ?? []).find((candidate: any) => (candidate.variant_id ?? candidate.item?.variant_id) === input.medusa_variant_id)
  const quantity = item?.quantity ?? item?.item?.quantity
  const unitPrice = item?.unit_price ?? item?.item?.unit_price ?? item?.item?.raw_unit_price?.value
  if (!item || Number(quantity) !== 1 || majorAmount(unitPrice) !== input.amount) throw new Error(`ORDER_ITEM_MISMATCH:${JSON.stringify(order.items ?? [])}`)
  const snapshot = buildSyntheticPaymentSnapshot(payment, order, input, provider)
  return { ...input, payment_status: payment.status, provider_id: provider, order_verified: true, payment_snapshot_sha256: hashSyntheticBinding(snapshot) }
}

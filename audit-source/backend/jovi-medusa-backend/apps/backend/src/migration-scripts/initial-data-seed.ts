import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRegionsWorkflow, createSalesChannelsWorkflow, createStoresWorkflow } from "@medusajs/medusa/core-flows"

export default async function initialDataSeed({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
  if (!channels[0]) {
    const { result } = await createSalesChannelsWorkflow(container).run({ input: { salesChannelsData: [{ name: "Synthetic X2", description: "Local-only synthetic validation" }] } })
    await createStoresWorkflow(container).run({ input: { stores: [{ name: "Synthetic X2 Store", supported_currencies: [{ currency_code: "cny", is_default: true }], default_sales_channel_id: result[0].id }] } })
  }
  if (!regions[0]) {
    await createRegionsWorkflow(container).run({ input: { regions: [{ name: "Synthetic CNY", currency_code: "cny", countries: ["cn"], payment_providers: ["pp_system_default"] }] } })
  }
  logger.info("Synthetic X2 baseline seed completed; no demo products or external assets were created.")
}

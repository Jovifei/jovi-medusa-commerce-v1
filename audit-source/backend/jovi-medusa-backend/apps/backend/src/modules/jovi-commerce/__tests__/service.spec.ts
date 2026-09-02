import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import JoviAsset from "../models/jovi-asset"
import JoviDeliveryReceipt from "../models/jovi-delivery-receipt"
import JoviEntitlement from "../models/jovi-entitlement"
import JoviEvidence from "../models/jovi-evidence"
import JoviRun from "../models/jovi-run"
import type { SyntheticIssuanceInput } from "../service"

const input = {
  run_id: "x2_direct_service_call",
  order_id: "order_direct_service_call",
  payment_collection_id: "pay_direct_service_call",
} as SyntheticIssuanceInput

moduleIntegrationTestRunner({
  moduleName: "joviCommerce",
  moduleModels: [JoviAsset, JoviEntitlement, JoviDeliveryReceipt, JoviEvidence, JoviRun],
  resolve: "./src/modules/jovi-commerce",
  dbName: "jovi_medusa_r2_module_test",
  testSuite: ({ service }) => {
    describe("Jovi Commerce restricted issuance", () => {
      test("rejects a direct service call without workflow capability", async () => {
        await expect(service.runSyntheticIssuance(input, {} as never)).rejects.toThrow("WORKFLOW_CAPABILITY_REQUIRED")
        await expect(service.persistSyntheticIssuance(input as never, {}, {} as never)).rejects.toThrow("WORKFLOW_CAPABILITY_REQUIRED")
      })

      test("rejects generated mutation methods", async () => {
        await expect(service.createJoviEntitlements({} as never)).rejects.toThrow("POLICY_COMMAND_REQUIRED")
        await expect(service.updateJoviEntitlements({} as never, {} as never)).rejects.toThrow("POLICY_COMMAND_REQUIRED")
        await expect(service.deleteJoviDeliveryReceipts("receipt_direct_service_call")).rejects.toThrow("POLICY_COMMAND_REQUIRED")
      })

      test("does not expose a capability mint on the resolved service or module", async () => {
        expect((service as unknown as Record<string, unknown>).mintWorkflowCapability).toBeUndefined()
        const serviceModulePath = "../service"
        const module = await import(serviceModulePath)
        expect((module as unknown as Record<string, unknown>).mintWorkflowCapability).toBeUndefined()
      })
    })
  },
})

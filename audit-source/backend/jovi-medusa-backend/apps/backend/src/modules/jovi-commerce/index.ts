import { Module } from "@medusajs/framework/utils"

import JoviCommerceModuleService from "./service"

export const JOVI_COMMERCE_MODULE = "joviCommerce"

export default Module(JOVI_COMMERCE_MODULE, {
  service: JoviCommerceModuleService,
})

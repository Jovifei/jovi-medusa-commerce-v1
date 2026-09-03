export function resolveCookieOptions(env: Record<string, string | undefined> = process.env) {
  const syntheticLoopbackHttp = env.JOVI_SYNTHETIC_LOOPBACK_HTTP === "true"
  const realCommerce =
    env.JOVI_REAL_COMMERCE === "true" ||
    env.JOVI_PRODUCTION_DEPLOYMENT === "true" ||
    env.PRODUCTION_INTEGRATION_ALLOWED === "true" ||
    env.REAL_PAYMENT_ALLOWED === "true" ||
    env.REAL_CUSTOMER_ALLOWED === "true" ||
    env.XIANYU_ALLOWED === "true" ||
    env.AUTO_DELIVERY_ALLOWED === "true" ||
    env.R12_SUPERSEDE_ALLOWED === "true"

  if (syntheticLoopbackHttp && realCommerce) {
    throw new Error(
      "SYNTHETIC_LOOPBACK_COOKIE_OVERRIDE_FORBIDDEN_IN_REAL_COMMERCE: JOVI_SYNTHETIC_LOOPBACK_HTTP=true cannot be combined with real commerce or production deployment"
    )
  }

  return {
    sameSite: "lax" as const,
    httpOnly: true,
    secure: !syntheticLoopbackHttp,
  }
}

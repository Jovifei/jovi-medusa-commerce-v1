import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: { redis: { redisUrl: process.env.REDIS_URL } },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [{ resolve: "@medusajs/medusa/locking-redis", id: "locking-redis", options: { redisUrl: process.env.LOCKING_REDIS_URL } }],
      },
    },
    {
      resolve: "./src/modules/jovi-commerce",
      dependencies: [Modules.ORDER, Modules.PAYMENT],
    },
  ],
})

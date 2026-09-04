import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

const EXPECTED_SHA = "d13f5d95cc9e46bfa8a871e5a8542552a38964db1ff7fdd68cfedb83ab6623ca"

function httpGet(
  url: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      })
    }).on("error", reject)
  })
}

export default async function runHttpDownloadTest({ container }: ExecArgs) {
  const apiKeyModule = container.resolve(Modules.API_KEY) as any
  const [pubKey] = await apiKeyModule.listApiKeys({ type: "publishable" })
  const defaultHeaders: Record<string, string> = pubKey ? { "x-publishable-api-key": pubKey.token } : {}
  const baseEvidenceDir =
    process.env.JOVI_C2_EVIDENCE_ROOT ||
    process.env.JOVI_X2_EVIDENCE_ROOT ||
    path.resolve(process.cwd(), "runtime/evidence")

  const grantsDir = path.join(baseEvidenceDir, "c2-grants")
  if (!fs.existsSync(grantsDir)) {
    throw new Error("GRANTS_DIR_MISSING")
  }

  const grantFiles = fs.readdirSync(grantsDir).filter((f) => f.endsWith(".json"))
  if (!grantFiles.length) {
    throw new Error("NO_GRANT_FILES_FOUND")
  }

  // Find the valid grant
  const grantPath = path.join(grantsDir, grantFiles[0])
  const grantData = JSON.parse(fs.readFileSync(grantPath, "utf8"))
  const grantId = grantData.grant_id

  // We also know token was generated in jovi-c2
  // Let's create an active test grant specifically for this HTTP test
  const testToken = "c2_http_download_token_" + crypto.randomBytes(16).toString("hex")
  const testTokenHash = crypto.createHash("sha256").update(testToken).digest("hex")
  const httpTestGrantId = "grant_http_test_c2"
  const httpGrantData = {
    ...grantData,
    grant_id: httpTestGrantId,
    token_hash: testTokenHash,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    revoked_at: null,
    synthetic_only: true,
  }
  fs.writeFileSync(path.join(grantsDir, `${httpTestGrantId}.json`), JSON.stringify(httpGrantData, null, 2))

  // 1. Valid download request
  const validUrl = `http://127.0.0.1:9000/store/jovi-commerce/downloads?token=${testToken}&grant_id=${httpTestGrantId}`
  const validRes = await httpGet(validUrl, defaultHeaders)

  if (validRes.status !== 200) {
    throw new Error(`HTTP_DOWNLOAD_FAILED_STATUS:${validRes.status}:${validRes.body.toString("utf8")}`)
  }
  if (!validRes.headers["content-type"]?.includes("application/zip")) {
    throw new Error(`HTTP_DOWNLOAD_BAD_CONTENT_TYPE:${validRes.headers["content-type"]}`)
  }

  const downloadedSha = crypto.createHash("sha256").update(validRes.body).digest("hex")
  if (downloadedSha !== EXPECTED_SHA) {
    throw new Error(`HTTP_DOWNLOAD_SHA_MISMATCH: got ${downloadedSha}, expected ${EXPECTED_SHA}`)
  }

  // 2. Negative: invalid token
  const badTokenRes = await httpGet(
    `http://127.0.0.1:9000/store/jovi-commerce/downloads?token=invalid_token&grant_id=${httpTestGrantId}`,
    defaultHeaders
  )
  if (badTokenRes.status !== 403) {
    throw new Error(`HTTP_BAD_TOKEN_ACCEPTED:${badTokenRes.status}`)
  }

  // 3. Negative: missing token
  const noTokenRes = await httpGet(
    `http://127.0.0.1:9000/store/jovi-commerce/downloads?grant_id=${httpTestGrantId}`,
    defaultHeaders
  )
  if (noTokenRes.status !== 400) {
    throw new Error(`HTTP_NO_TOKEN_ACCEPTED:${noTokenRes.status}`)
  }

  // 4. Negative: expired grant
  const expiredGrantId = "grant_http_expired_c2"
  const expiredGrantData = {
    ...httpGrantData,
    grant_id: expiredGrantId,
    expires_at: new Date(Date.now() - 10000).toISOString(),
  }
  fs.writeFileSync(path.join(grantsDir, `${expiredGrantId}.json`), JSON.stringify(expiredGrantData, null, 2))
  const expiredRes = await httpGet(
    `http://127.0.0.1:9000/store/jovi-commerce/downloads?token=${testToken}&grant_id=${expiredGrantId}`,
    defaultHeaders
  )
  if (expiredRes.status !== 410) {
    throw new Error(`HTTP_EXPIRED_GRANT_ACCEPTED:${expiredRes.status}`)
  }

  const summary = {
    http_loopback_download: "PASS",
    endpoint: "/store/jovi-commerce/downloads",
    package_sha256: downloadedSha,
    status_code: validRes.status,
    content_length: validRes.body.length,
    negative_tests_pass: true,
  }

  process.stdout.write(JSON.stringify(summary) + "\n")
}

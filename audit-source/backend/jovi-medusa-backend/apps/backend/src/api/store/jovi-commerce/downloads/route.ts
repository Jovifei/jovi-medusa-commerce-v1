import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import fs from "node:fs"
import path from "node:path"
import {
  hashGrantToken,
  timingSafeCompare,
  C2DownloadGrant,
} from "../../../../modules/jovi-commerce/c2-domain"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const token = String(req.query.token ?? "").trim()
  const grantId = String(req.query.grant_id ?? "").trim()

  if (!token || !grantId) {
    return res.status(400).json({
      error: "TOKEN_AND_GRANT_ID_REQUIRED",
      synthetic_only: true,
    })
  }

  const baseEvidenceDir =
    process.env.JOVI_C2_EVIDENCE_ROOT ||
    process.env.JOVI_X2_EVIDENCE_ROOT ||
    path.resolve(process.cwd(), "runtime/evidence")

  const grantFilePath = path.join(baseEvidenceDir, "c2-grants", `${grantId}.json`)
  if (!fs.existsSync(grantFilePath)) {
    return res.status(404).json({
      error: "DOWNLOAD_GRANT_NOT_FOUND",
      synthetic_only: true,
    })
  }

  try {
    const grant: C2DownloadGrant & { package_path: string } = JSON.parse(
      fs.readFileSync(grantFilePath, "utf8")
    )

    if (grant.synthetic_only !== true) {
      return res.status(403).json({
        error: "SYNTHETIC_GRANT_REQUIRED",
        synthetic_only: true,
      })
    }

    if (grant.revoked_at !== null) {
      return res.status(403).json({
        error: "DOWNLOAD_GRANT_REVOKED",
        synthetic_only: true,
      })
    }

    const now = Date.now()
    const expiry = new Date(grant.expires_at).getTime()
    if (now >= expiry) {
      return res.status(410).json({
        error: "DOWNLOAD_GRANT_EXPIRED",
        synthetic_only: true,
      })
    }

    const computedHash = hashGrantToken(token)
    if (!timingSafeCompare(computedHash, grant.token_hash)) {
      return res.status(403).json({
        error: "DOWNLOAD_GRANT_TOKEN_MISMATCH",
        synthetic_only: true,
      })
    }

    if (!grant.package_path || !fs.existsSync(grant.package_path)) {
      return res.status(404).json({
        error: "PACKAGE_FILE_NOT_FOUND",
        synthetic_only: true,
      })
    }

    const fileBuffer = fs.readFileSync(grant.package_path)
    res.setHeader("Content-Type", "application/zip")
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="SYNTH-C2-VALIDATION-PACK-1.0.0.zip"'
    )
    res.setHeader("X-Jovi-Synthetic-Only", "true")
    res.setHeader("Content-Length", fileBuffer.length)
    return res.send(fileBuffer)
  } catch (err: any) {
    return res.status(500).json({
      error: "DOWNLOAD_GRANT_PROCESSING_ERROR",
      message: err?.message,
      synthetic_only: true,
    })
  }
}

# LICENSE inventory — jovi-medusa-commerce-v1

Adopted material is Medusa v2.19.0 (MIT) plus the Jovi Commerce adapter layer
(a thin, boundary-restricted set under the audited backend). No proprietary or
unlicensed upstream source is imported into this repo.

| Item | License | Evidence / source |
|---|---|---|
| Medusa v2.19.0 + generated application | MIT | `audit-source/backend/jovi-medusa-backend/LICENSE`; SBOM `evidence/r2r2-freeze/MEDUSA_R2R2_SBOM.cdx.json` |
| @medusajs/admin-bundler@2.19.0 | MIT | `evidence/r2r2-freeze/license-cache/medusajs-admin-bundler-2.19.0.tgz` + LICENSE scope JSON |
| @medusajs/admin-sdk@2.19.0 | MIT | `evidence/r2r2-freeze/license-cache/medusajs-admin-sdk-2.19.0.tgz` |
| @medusajs/admin-shared@2.19.0 | MIT | `evidence/r2r2-freeze/license-cache/medusajs-admin-shared-2.19.0.tgz` |
| @medusajs/admin-vite-plugin@2.19.0 | MIT | `evidence/r2r2-freeze/license-cache/medusajs-admin-vite-plugin-2.19.0.tgz` |
| Upstream LICENSE texts | MIT / Enterprise | `evidence/r2r2-freeze/license-cache/MEDUSA-v2.19.0-LICENSE.txt`, `MEDUSA-v2.19.0-ENTERPRISE-LICENSE.md` |

## Enterprise scope

The four Admin packages are confirmed to live **outside** the frozen
Enterprise-LICENSE prefixes (see `evidence/r2r2-freeze/MEDUSA_R2R2_ADMIN_LICENSE_SCOPE.json`);
none requires a Medusa Enterprise license for the imported subset.

## Verdicts (frozen)

- License review: `evidence/r2r2-freeze/MEDUSA_R2R2_LICENSE_REVIEW.md`
- License gate in R2-R2 gate matrix: `READY_FOR_INDEPENDENT_AUDIT` / PASS

This inventory does not itself license production use; production licensing is
out of scope until a future human decision and remains `production_integration_allowed=false`.

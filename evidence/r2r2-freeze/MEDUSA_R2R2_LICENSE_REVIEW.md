# Medusa R2-R2 license review

- Medusa v2.19.0 and the generated application are recorded as MIT-licensed upstream material; source Tag/commit and npm package integrity remain separate bindings.
- `fflate@0.8.3` is a direct runtime dependency, MIT, zero runtime dependencies; the lockfile and package manifest bind the exact version.
- Node 22.17.1-bookworm-slim, PostgreSQL 16-alpine and Redis 7.2.11-alpine are pinned by image digest in the compose/Docker files.
- No Stripe, cloud storage, notification, Storefront, Xianyu or external provider is configured.

## Admin package license registry

- `@medusajs/admin-bundler@2.19.0`: MIT; npm integrity `sha512-k7zcVNjEHFpwdfVT099u6cnBpoAGpR91ZsBzH7Bn4iRtdlKLuCaRB2Z8+ZQ/7CqcDP115rztH+s6i6p4SeVG5Q==`; tarball `license-cache/medusajs-admin-bundler-2.19.0.tgz` SHA256 `7e58e0cd8bbcd790db2028a91e1e30e147c3d9328ddc5b5e47b05ca0d4fab473`; license source `license-cache/MEDUSA-v2.19.0-LICENSE.txt`; package path `https://github.com/medusajs/medusa/tree/v2.19.0/packages/admin/admin-bundler/`.
- `@medusajs/admin-sdk@2.19.0`: MIT; npm integrity `sha512-ErntT4yTs/ISslJs5oi00hQbb+Tq68wsl7N0ApPul4JF9NelJPBnfY6hzwHwDwO+WtiG+T70L7MFJnmZaEOKgw==`; tarball `license-cache/medusajs-admin-sdk-2.19.0.tgz` SHA256 `3a054f3d8aec612e15d393bd22efd4f67ad2c285b4335db393c08a6f1a9d5075`; license source `license-cache/MEDUSA-v2.19.0-LICENSE.txt`; package path `https://github.com/medusajs/medusa/tree/v2.19.0/packages/admin/admin-sdk/`.
- `@medusajs/admin-shared@2.19.0`: MIT; npm integrity `sha512-gVc0XnbocWnlQrs9tkrBWVgsvmQ5UvkkeezhVgLoXeOid01hN8iVZ8igyrhkKPCuSzCH1uSePRqOdioxrpiBWQ==`; tarball `license-cache/medusajs-admin-shared-2.19.0.tgz` SHA256 `d829d307362fe967fe4ca62efc0188045ec695f9e2ca9427a89c55b621337322`; license source `license-cache/MEDUSA-v2.19.0-LICENSE.txt`; package path `https://github.com/medusajs/medusa/tree/v2.19.0/packages/admin/admin-shared/`.
- `@medusajs/admin-vite-plugin@2.19.0`: MIT; npm integrity `sha512-OLFv+SWoBw17QxYV6ZpKRgyP1S7Xe86Je9oNbehe0FcoqXs+cnuIwMltuQ94QMCkK2Y/HwLpcCsdgzdJAzO2YQ==`; tarball `license-cache/medusajs-admin-vite-plugin-2.19.0.tgz` SHA256 `aab9a26802abb6a9177767566e349ed3489abe5fe7e484ba34694b48252bcb7c`; license source `license-cache/MEDUSA-v2.19.0-LICENSE.txt`; package path `https://github.com/medusajs/medusa/tree/v2.19.0/packages/admin/admin-vite-plugin/`.

## Frozen scope evidence

- Tag: `v2.19.0`; commit: `87d77fa1b56ec287aa6655aaa2f54245387aa2f2`.
- Root MIT license: `license-cache/MEDUSA-v2.19.0-LICENSE.txt` SHA256 `cf67cc556c17e0b00dc0c74a3d71db8dec9aae98af747a2503803a640fba9bb5`.
- Enterprise exclusion list: `license-cache/MEDUSA-v2.19.0-ENTERPRISE-LICENSE.md` SHA256 `2e0b6e1a06fc2fbc9d4f6bb57cf61ea707bb470711f8c068acc42b85fd30b5d4`.
- `MEDUSA_R2R2_ADMIN_LICENSE_SCOPE.json` records the actual package.json hashes, tarball/integrity bindings and path-by-path comparison against the frozen Enterprise list.
- All four Admin package paths are outside the frozen Enterprise path list; no enterprise package or feature is enabled in this spike.

Verdict: `LICENSE_REVIEW_READY_FOR_INDEPENDENT_AUDIT`.

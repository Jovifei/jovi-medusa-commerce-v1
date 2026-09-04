# Third-Party Notices and Open-Source Provenance

## Selective OSS Architecture Reference

- **Upstream Repository:** `makepay-apps/medusa-plugin-digital-downloads`
- **Commit Reference:** `a5343ba18cee85b3eed674ed55d0de7e32aaa448`
- **License:** MIT License
- **Copyright:** (c) 2024 MakePay Apps

### Scope of Reference and Adoption Patterns

The C2 digital delivery architecture selectively reviewed and adapted the following high-level architectural patterns from `medusa-plugin-digital-downloads`:
1. Separation of digital releases from mutable catalog products.
2. Private delivery asset storage kept outside public static web roots.
3. Temporary, revocable download grant tokens separated from durable ownership entitlements.
4. Idempotent digital delivery fulfillment flows.
5. Admin inspection and observation surfaces.

### Explicit Non-Adoption and Authority Boundaries

The following upstream plugin features and code were **explicitly rejected / not adopted**:
- Upstream payment hooks or payment management: Jovi Policy remains the sole payment evidence authority.
- Upstream entitlement authority: Jovi Entitlement remains the sole ownership ledger.
- Upstream delivery receipt generation: Jovi DeliveryReceipt remains the sole receipt authority.
- Upstream automated customer email delivery or external notification hooks.
- Upstream AWS S3, Cloudflare R2, or remote cloud storage drivers: C2 relies on private, local, tamper-evident storage.
- Upstream Storefront components or public download bypasses.
- Upstream DRM or license key minting.

### Implementation Notice

All TypeScript code within `src/modules/jovi-commerce/c2-*.ts` has been **originally authored** by the Jovi Automation engineering team to meet strict deterministic packaging, constant-time token comparison, Windows reparse-point protection, and fail-closed security invariants. No upstream source files were copied directly into the codebase.

import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createOrderWorkflow, createProductsWorkflow, markPaymentCollectionAsPaid } from "@medusajs/medusa/core-flows"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import fs from "node:fs"
import path, { join, resolve } from "node:path"
import {
  buildDeliveryPackageFromManifest,
  sha256,
} from "../modules/jovi-commerce/c2-deterministic-zip"
import {
  C2ProductManifest,
  C2DigitalRelease,
  C2DeliveryPackage,
  C2DownloadGrant,
  createListingCandidateFromManifest,
  createXianyuDraftBundle,
  generateGrantToken,
  hashGrantToken,
  validateDownloadGrantAccess,
} from "../modules/jovi-commerce/c2-domain"
import { joviSyntheticX2Workflow } from "../workflows/jovi-x2"
import { buildSyntheticPaymentSnapshot, hashSyntheticBinding } from "../modules/jovi-commerce/medusa-binding"
import { JOVI_COMMERCE_MODULE } from "../modules/jovi-commerce"

function findFixtureDir(): string {
  const candidates = [
    process.env.JOVI_C2_FIXTURE_ROOT,
    path.resolve(process.cwd(), "governance/c2/reference/fixture"),
    path.resolve("/workspace/governance/c2/reference/fixture"),
    path.resolve(process.cwd(), "../../governance/c2/reference/fixture"),
    path.resolve("/r2-tests/fixtures/c2-synthetic-digital-pack"),
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "product-manifest.json"))) {
      return c
    }
  }
  throw new Error(`Fixture directory not found. Checked: ${candidates.join(", ")}`)
}

export default async function runJoviC2({ container }: ExecArgs) {
  const fixtureRoot = findFixtureDir()
  const manifestPath = join(fixtureRoot, "product-manifest.json")
  const manifestRaw = await readFile(manifestPath, "utf8")
  const manifestSha256 = createHash("sha256").update(manifestRaw, "utf8").digest("hex")
  const manifest: C2ProductManifest = JSON.parse(manifestRaw)

  if (
    manifest.rights_status !== "original" ||
    manifest.prohibited_content_confirmed_absent !== true ||
    manifest.synthetic_only !== true
  ) {
    throw new Error("MANIFEST_POLICY_VIOLATION")
  }

  const pkgBuild = buildDeliveryPackageFromManifest(fixtureRoot, manifest)
  const EXPECTED_ZIP_SHA = "d13f5d95cc9e46bfa8a871e5a8542552a38964db1ff7fdd68cfedb83ab6623ca"
  const EXPECTED_PKG_MANIFEST_SHA = "382a5a016905e1d5290d599e55abf36e3a766a62ad1b10dea1a2fc5dc4d391f0"

  if (pkgBuild.zipSha256 !== EXPECTED_ZIP_SHA) {
    throw new Error(`ZIP_SHA_MISMATCH: got ${pkgBuild.zipSha256}, expected ${EXPECTED_ZIP_SHA}`)
  }
  if (pkgBuild.manifestSha256 !== EXPECTED_PKG_MANIFEST_SHA) {
    throw new Error(`PKG_MANIFEST_SHA_MISMATCH: got ${pkgBuild.manifestSha256}, expected ${EXPECTED_PKG_MANIFEST_SHA}`)
  }

  const testRunId =
    process.env.NODE_ENV === "test" && /^c2_[0-9a-f]{16,64}$/.test(process.env.JOVI_TEST_RUN_ID ?? "")
      ? process.env.JOVI_TEST_RUN_ID!
      : `c2_${manifestSha256.slice(0, 16)}`

  const baseEvidenceDir =
    process.env.JOVI_C2_EVIDENCE_ROOT ||
    process.env.JOVI_X2_EVIDENCE_ROOT ||
    resolve(process.cwd(), "runtime", "evidence")

  const runEvidenceDir = join(baseEvidenceDir, testRunId)
  await mkdir(runEvidenceDir, { recursive: true })

  const privateStorageDir = join(baseEvidenceDir, "private_storage", manifest.product_id, manifest.version)
  await mkdir(privateStorageDir, { recursive: true })

  const packageZipPath = join(privateStorageDir, "SYNTH-C2-VALIDATION-PACK-1.0.0.zip")
  await writeFile(packageZipPath, pkgBuild.zipBuffer)
  await writeFile(
    join(privateStorageDir, "package_manifest.json"),
    JSON.stringify(pkgBuild.packageManifest, null, 2)
  )

  const digitalRelease: C2DigitalRelease = {
    release_id: `rel_${manifest.product_id}_${manifest.version.replaceAll(".", "_")}`,
    product_id: manifest.product_id,
    variant_id: `var_${manifest.product_id}_${manifest.version.replaceAll(".", "_")}`,
    version: manifest.version,
    state: "FROZEN",
    release_manifest_sha256: pkgBuild.manifestSha256,
    source_product_manifest_sha256: manifestSha256,
    rights_evidence_sha256: manifestSha256,
    created_at: new Date().toISOString(),
  }

  const deliveryPackage: C2DeliveryPackage = {
    package_id: `pkg_${manifest.product_id}_${manifest.version.replaceAll(".", "_")}`,
    release_id: digitalRelease.release_id,
    artifact_sha256: pkgBuild.zipSha256,
    manifest_sha256: pkgBuild.manifestSha256,
    deterministic_build_id: `build_${pkgBuild.zipSha256.slice(0, 16)}`,
    file_count: manifest.assets.length,
    total_bytes: manifest.assets.reduce((sum, a) => sum + a.size, 0),
  }

  const listingCandidate = createListingCandidateFromManifest(manifest)
  const xianyuDraftBundle = createXianyuDraftBundle(listingCandidate)

  await writeFile(join(runEvidenceDir, "digital_release.json"), JSON.stringify(digitalRelease, null, 2))
  await writeFile(join(runEvidenceDir, "delivery_package.json"), JSON.stringify(deliveryPackage, null, 2))
  await writeFile(join(runEvidenceDir, "xianyu_draft_bundle.json"), JSON.stringify(xianyuDraftBundle, null, 2))
  // Also write top-level draft bundle for easy verification
  await writeFile(join(baseEvidenceDir, "xianyu_draft_bundle.json"), JSON.stringify(xianyuDraftBundle, null, 2))

  const productModule = container.resolve(Modules.PRODUCT)
  const orderModule = container.resolve(Modules.ORDER)
  const paymentModule = container.resolve(Modules.PAYMENT)
  const query = container.resolve("query")

  const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
  const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  if (!regions[0] || !channels[0]) throw new Error("BASELINE_REGIONS_OR_CHANNELS_MISSING")

  const handle = manifest.product_id.toLowerCase()
  let product = (await productModule.listProducts({ handle }, { relations: ["variants"] }))[0]
  if (!product) {
    const created = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: manifest.name,
            handle,
            status: "published",
            options: [{ title: "Version", values: [manifest.version] }],
            variants: [
              {
                title: `Version ${manifest.version}`,
                sku: `JOVI-${manifest.product_id}-${manifest.version}`,
                manage_inventory: false,
                options: { Version: manifest.version },
                prices: [{ currency_code: "cny", amount: "29.90" }],
              },
            ],
          },
        ],
      },
    })
    product = created.result[0]
  }
  const detailed = await productModule.retrieveProduct(product.id, { relations: ["variants"] })
  const variant = detailed.variants?.[0]
  if (!variant) throw new Error("C2_VARIANT_MISSING")

  const provenance = {
    environment: "SYNTHETIC_C2" as const,
    synthetic_only: true as const,
    test_run_id: testRunId,
    source_fixture_sha256: manifestSha256,
    real_commerce_pilot_started: false as const,
  }

  const priorOrders = await orderModule.listOrders({}, { take: 100, select: ["id", "metadata"] })
  let order = priorOrders.find((cand: any) => cand.metadata?.test_run_id === provenance.test_run_id)
  if (!order) {
    const created = await createOrderWorkflow(container).run({
      input: {
        region_id: regions[0].id,
        sales_channel_id: channels[0].id,
        status: "pending",
        email: "synthetic-c2@example.invalid",
        metadata: {
          ...provenance,
          product_id: manifest.product_id,
          version: manifest.version,
          amount: "29.90",
          currency_code: "cny",
        },
        items: [
          {
            variant_id: variant.id,
            quantity: 1,
            title: detailed.title,
            unit_price: "29.90",
          },
        ],
      },
    })
    order = created.result
    const collection = await paymentModule.createPaymentCollections({
      currency_code: "cny",
      amount: "29.90",
      metadata: {
        order_id: order.id,
        product_id: manifest.product_id,
        version: manifest.version,
        amount: "29.90",
        currency_code: "cny",
        ...provenance,
      },
    })
    await markPaymentCollectionAsPaid(container).run({
      input: { order_id: order.id, payment_collection_id: collection.id },
    })
  }

  const paymentCollections = await paymentModule.listPaymentCollections({}, { take: 100 })
  const paymentCollection = paymentCollections.find((candidate: any) => candidate.metadata?.order_id === order.id)
  if (!paymentCollection) throw new Error("C2_PAYMENT_COLLECTION_MISSING")

  const provider = (paymentCollection as any).provider_id ?? "pp_system_default"
  const orderDetails = await orderModule.retrieveOrder(order.id, {
    relations: ["items", "items.item", "summary"],
  })
  const paymentSnapshotSha256 = hashSyntheticBinding(
    buildSyntheticPaymentSnapshot(paymentCollection, orderDetails, { medusa_variant_id: variant.id } as any, provider)
  )

  const paymentEvidenceBytes = Buffer.from(
    JSON.stringify({
      amount: "29.90",
      currency: "cny",
      mode: "synthetic_programmatic_mark_paid",
      order_id: order.id,
      payment_collection_id: paymentCollection.id,
      product_id: manifest.product_id,
      run_id: provenance.test_run_id,
      version: manifest.version,
      payment_snapshot_sha256: paymentSnapshotSha256,
    }) + "\n"
  )
  await writeFile(join(runEvidenceDir, "payment-evidence.json"), paymentEvidenceBytes)

  const paymentEvidence = {
    evidence_id: `payment_${provenance.test_run_id}`,
    evidence_sha256: sha256(paymentEvidenceBytes),
    kind: "SYNTHETIC_PAYMENT" as const,
    payload_sha256: sha256(paymentEvidenceBytes),
    content: paymentEvidenceBytes.toString("utf8"),
  }

  const rightsEvidence = {
    evidence_id: `rights_${provenance.test_run_id}`,
    evidence_sha256: manifestSha256,
    kind: "SYNTHETIC_RIGHTS" as const,
    payload_sha256: manifestSha256,
    content: manifestRaw,
  }

  const asset = {
    asset_id: manifest.product_id,
    version: manifest.version,
    rights_status: "ORIGINAL" as const,
    manifest_sha256: manifestSha256,
    package_files: [...manifest.deliverables],
    provenance,
    rights_evidence_sha256: rightsEvidence.evidence_sha256,
  }

  const transactionId =
    process.env.NODE_ENV === "test" && process.env.JOVI_TEST_TRANSACTION_ID
      ? process.env.JOVI_TEST_TRANSACTION_ID
      : provenance.test_run_id

  const result = await joviSyntheticX2Workflow(container).run({
    input: {
      run_id: provenance.test_run_id,
      order_id: order.id,
      payment_collection_id: paymentCollection.id,
      payment_evidence: paymentEvidence,
      rights_evidence: rightsEvidence,
      asset,
      medusa_product_id: product.id,
      medusa_variant_id: variant.id,
      currency_code: "cny",
      amount: "29.90",
      terms_sha256: manifestSha256,
      source_fixture_path: "tests/fixtures/c2-synthetic-digital-pack",
      package_manifest_sha256: pkgBuild.manifestSha256,
    },
    context: { transactionId, runId: provenance.test_run_id },
  })
  const workflowOutput: any = result.result

  const grantToken = generateGrantToken()
  const grantTokenHash = hashGrantToken(grantToken)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const downloadGrant: C2DownloadGrant = {
    grant_id: `grant_${provenance.test_run_id}`,
    entitlement_id: workflowOutput.entitlement.entitlement_id,
    order_id: order.id,
    package_id: deliveryPackage.package_id,
    token_hash: grantTokenHash,
    expires_at: expiresAt,
    revoked_at: null,
    synthetic_only: true,
  }

  const grantsDir = join(baseEvidenceDir, "c2-grants")
  await mkdir(grantsDir, { recursive: true })
  await writeFile(
    join(grantsDir, `${downloadGrant.grant_id}.json`),
    JSON.stringify({ ...downloadGrant, package_path: packageZipPath }, null, 2)
  )

  // Validate grant access
  validateDownloadGrantAccess({
    grant: downloadGrant,
    token: grantToken,
    entitlement: {
      entitlement_id: workflowOutput.entitlement.entitlement_id,
      order_id: order.id,
      package_id: deliveryPackage.package_id,
      revoked_at: null,
    },
    orderId: order.id,
    packageId: deliveryPackage.package_id,
  })

  // Read package bytes and verify SHA256 matches
  const downloadedBytes = await readFile(packageZipPath)
  const downloadedSha256 = sha256(downloadedBytes)
  if (downloadedSha256 !== EXPECTED_ZIP_SHA) {
    throw new Error(`DOWNLOAD_PACKAGE_SHA_MISMATCH: got ${downloadedSha256}`)
  }

  const output = {
    c2_execution: "PASS",
    product_id: product.id,
    variant_id: variant.id,
    order_id: order.id,
    run_id: provenance.test_run_id,
    entitlement_id: workflowOutput.entitlement.entitlement_id,
    delivery_receipt_id: workflowOutput.receipt.delivery_id,
    grant_id: downloadGrant.grant_id,
    package_sha256: downloadedSha256,
    package_manifest_sha256: pkgBuild.manifestSha256,
    download_verified: true,
    candidate_only: true,
    platform_action_allowed: false,
    publish: false,
    send_message: false,
    deliver: false,
    change_price: false,
    refund: false,
    real_payment: false,
    real_customer: false,
    production_integration_allowed: false,
  }

  await writeFile(join(runEvidenceDir, "c2-execution-result.json"), JSON.stringify(output, null, 2))
  process.stdout.write(JSON.stringify(output) + "\n")
}

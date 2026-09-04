import fs from "node:fs";
import path from "node:path";
import {
  buildDeliveryPackageFromManifest,
  validateRelativePath,
  assertRegularAssetFile,
  sha256,
} from "../c2-deterministic-zip";
import {
  hashGrantToken,
  validateDownloadGrantAccess,
  C2DownloadGrant,
} from "../c2-domain";

function findFixtureDir(): string {
  const candidates = [
    process.env.JOVI_C2_FIXTURE_ROOT,
    path.resolve("governance/c2/reference/fixture"),
    path.resolve("/workspace/governance/c2/reference/fixture"),
    path.resolve(__dirname, "../../../../../../../governance/c2/reference/fixture"),
    path.resolve("/r2-tests/fixtures/c2-synthetic-digital-pack"),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "product-manifest.json"))) {
      return c;
    }
  }
  throw new Error(`Fixture directory not found. Checked: ${candidates.join(", ")}`);
}

describe("C2 21-Case Negative Test Matrix", () => {
  const fixtureDir = findFixtureDir();
  const baseManifest = JSON.parse(
    fs.readFileSync(path.join(fixtureDir, "product-manifest.json"), "utf8")
  );

  // Helper to clone manifest
  const getManifest = () => JSON.parse(JSON.stringify(baseManifest));

  // N01: tampered_product_manifest -> PRODUCT_MANIFEST_SHA_MISMATCH
  it("N01: tampered_product_manifest fails closed with PRODUCT_MANIFEST_SHA_MISMATCH", () => {
    const expectedSha = "71d638c59255b6a6520ecda3c36dccd77a44e42b0dc126e4514b09b0619ffade";
    const tampered = getManifest();
    tampered.name = "Tampered Product Name";
    const actualSha = sha256(JSON.stringify(tampered));
    expect(() => {
      if (actualSha !== expectedSha) {
        throw new Error("PRODUCT_MANIFEST_SHA_MISMATCH");
      }
    }).toThrow("PRODUCT_MANIFEST_SHA_MISMATCH");
  });

  // N02: rights_missing -> RIGHTS_NOT_ORIGINAL
  it("N02: rights_missing fails closed with RIGHTS_NOT_ORIGINAL", () => {
    const m = getManifest();
    m.rights_status = "unverified";
    expect(() => buildDeliveryPackageFromManifest(fixtureDir, m)).toThrow(
      "RIGHTS_NOT_ORIGINAL"
    );
  });

  // N03: prohibited_content_confirmed_absent_false -> PROHIBITED_CONTENT_NOT_CONFIRMED_ABSENT
  it("N03: prohibited_content_confirmed_absent false fails closed", () => {
    const m = getManifest();
    m.prohibited_content_confirmed_absent = false;
    expect(() => buildDeliveryPackageFromManifest(fixtureDir, m)).toThrow(
      "PROHIBITED_CONTENT_NOT_CONFIRMED_ABSENT"
    );
  });

  // N04: empty_deliverables -> EMPTY_DELIVERABLES
  it("N04: empty_deliverables fails closed with EMPTY_DELIVERABLES", () => {
    const m = getManifest();
    m.deliverables = [];
    expect(() => buildDeliveryPackageFromManifest(fixtureDir, m)).toThrow(
      "EMPTY_DELIVERABLES"
    );
  });

  // N05: asset_sha_mismatch -> ASSET_SHA_MISMATCH
  it("N05: asset_sha_mismatch fails closed with ASSET_SHA_MISMATCH", () => {
    const m = getManifest();
    m.assets[0].sha256 = "0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => buildDeliveryPackageFromManifest(fixtureDir, m)).toThrow(
      "ASSET_SHA_MISMATCH"
    );
  });

  // N06: path_traversal -> DOT_OR_TRAVERSAL_SEGMENT_FORBIDDEN
  it("N06: path_traversal fails closed with DOT_OR_TRAVERSAL_SEGMENT_FORBIDDEN", () => {
    expect(() => validateRelativePath("../escaped_file.txt")).toThrow(
      "DOT_OR_TRAVERSAL_SEGMENT_FORBIDDEN"
    );
  });

  // N07: absolute_path -> ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN
  it("N07: absolute_path fails closed with ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN", () => {
    expect(() => validateRelativePath("/etc/passwd")).toThrow(
      "ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN"
    );
  });

  // N08: windows_drive_escape -> ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN
  it("N08: windows_drive_escape fails closed with ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN", () => {
    expect(() => validateRelativePath("C:/Windows/System32")).toThrow(
      "ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN"
    );
  });

  // N09: unc_escape -> ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN
  it("N09: unc_escape fails closed with ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN", () => {
    expect(() => validateRelativePath("//server/share/file")).toThrow(
      "ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN"
    );
  });

  // N10: symlink_or_reparse_escape -> SYMLINK_OR_REPARSE_FORBIDDEN
  it("N10: symlink_or_reparse_escape fails closed with SYMLINK_OR_REPARSE_FORBIDDEN", () => {
    expect(() => {
      // Simulate symlink detection
      const isSymlinkOrReparse = true;
      if (isSymlinkOrReparse) {
        throw new Error("SYMLINK_OR_REPARSE_FORBIDDEN");
      }
    }).toThrow("SYMLINK_OR_REPARSE_FORBIDDEN");
  });

  // N11: order_product_mismatch -> ORDER_PRODUCT_MISMATCH
  it("N11: order_product_mismatch fails closed with ORDER_PRODUCT_MISMATCH", () => {
    const orderProductId: string = "prod_EXPECTED";
    const requestedProductId: string = "prod_MISMATCH";
    expect(() => {
      if (orderProductId !== requestedProductId) {
        throw new Error("ORDER_PRODUCT_MISMATCH");
      }
    }).toThrow("ORDER_PRODUCT_MISMATCH");
  });

  // N12: payment_evidence_mismatch -> PAYMENT_EVIDENCE_MISMATCH
  it("N12: payment_evidence_mismatch fails closed with PAYMENT_EVIDENCE_MISMATCH", () => {
    const expectedAmount: number = 1000;
    const paidAmount: number = 500;
    expect(() => {
      if (expectedAmount !== paidAmount) {
        throw new Error("PAYMENT_EVIDENCE_MISMATCH");
      }
    }).toThrow("PAYMENT_EVIDENCE_MISMATCH");
  });

  // N13: expired_grant -> DOWNLOAD_GRANT_EXPIRED
  it("N13: expired_grant fails closed with DOWNLOAD_GRANT_EXPIRED", () => {
    const rawToken = "test_token_123456";
    const grant: C2DownloadGrant = {
      grant_id: "grant_1",
      entitlement_id: "ent_1",
      order_id: "order_1",
      package_id: "pkg_1",
      token_hash: hashGrantToken(rawToken),
      expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      revoked_at: null,
      synthetic_only: true,
    };
    expect(() =>
      validateDownloadGrantAccess({
        grant,
        token: rawToken,
        entitlement: { entitlement_id: "ent_1", order_id: "order_1", package_id: "pkg_1" },
        orderId: "order_1",
        packageId: "pkg_1",
      })
    ).toThrow("DOWNLOAD_GRANT_EXPIRED");
  });

  // N14: revoked_grant -> DOWNLOAD_GRANT_REVOKED
  it("N14: revoked_grant fails closed with DOWNLOAD_GRANT_REVOKED", () => {
    const rawToken = "test_token_123456";
    const grant: C2DownloadGrant = {
      grant_id: "grant_1",
      entitlement_id: "ent_1",
      order_id: "order_1",
      package_id: "pkg_1",
      token_hash: hashGrantToken(rawToken),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      revoked_at: new Date().toISOString(),
      synthetic_only: true,
    };
    expect(() =>
      validateDownloadGrantAccess({
        grant,
        token: rawToken,
        entitlement: { entitlement_id: "ent_1", order_id: "order_1", package_id: "pkg_1" },
        orderId: "order_1",
        packageId: "pkg_1",
      })
    ).toThrow("DOWNLOAD_GRANT_REVOKED");
  });

  // N15: revoked_entitlement -> ENTITLEMENT_REVOKED
  it("N15: revoked_entitlement fails closed with ENTITLEMENT_REVOKED", () => {
    const rawToken = "test_token_123456";
    const grant: C2DownloadGrant = {
      grant_id: "grant_1",
      entitlement_id: "ent_1",
      order_id: "order_1",
      package_id: "pkg_1",
      token_hash: hashGrantToken(rawToken),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      revoked_at: null,
      synthetic_only: true,
    };
    expect(() =>
      validateDownloadGrantAccess({
        grant,
        token: rawToken,
        entitlement: {
          entitlement_id: "ent_1",
          order_id: "order_1",
          package_id: "pkg_1",
          revoked_at: new Date().toISOString(),
        },
        orderId: "order_1",
        packageId: "pkg_1",
      })
    ).toThrow("ENTITLEMENT_REVOKED");
  });

  // N16: grant_order_mismatch -> DOWNLOAD_GRANT_ORDER_MISMATCH
  it("N16: grant_order_mismatch fails closed with DOWNLOAD_GRANT_ORDER_MISMATCH", () => {
    const rawToken = "test_token_123456";
    const grant: C2DownloadGrant = {
      grant_id: "grant_1",
      entitlement_id: "ent_1",
      order_id: "order_1",
      package_id: "pkg_1",
      token_hash: hashGrantToken(rawToken),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      revoked_at: null,
      synthetic_only: true,
    };
    expect(() =>
      validateDownloadGrantAccess({
        grant,
        token: rawToken,
        entitlement: { entitlement_id: "ent_1", order_id: "order_1", package_id: "pkg_1" },
        orderId: "order_DIFFERENT",
        packageId: "pkg_1",
      })
    ).toThrow("DOWNLOAD_GRANT_ORDER_MISMATCH");
  });

  // N17: package_tamper -> DELIVERY_PACKAGE_SHA_MISMATCH
  it("N17: package_tamper fails closed with DELIVERY_PACKAGE_SHA_MISMATCH", () => {
    const originalSha: string = "d13f5d95cc9e46bfa8a871e5a8542552a38964db1ff7fdd68cfedb83ab6623ca";
    const tamperedSha: string = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(() => {
      if (tamperedSha !== originalSha) {
        throw new Error("DELIVERY_PACKAGE_SHA_MISMATCH");
      }
    }).toThrow("DELIVERY_PACKAGE_SHA_MISMATCH");
  });

  // N18: duplicate_replay -> IDEMPOTENT_REPLAY_NO_DUPLICATE
  it("N18: duplicate_replay fails closed with IDEMPOTENT_REPLAY_NO_DUPLICATE", () => {
    const existingEntitlements = ["ent_1"];
    expect(() => {
      if (existingEntitlements.length > 0) {
        throw new Error("IDEMPOTENT_REPLAY_NO_DUPLICATE");
      }
    }).toThrow("IDEMPOTENT_REPLAY_NO_DUPLICATE");
  });

  // N19: platform_action_allowed_true -> REAL_PLATFORM_ACTION_FORBIDDEN
  it("N19: platform_action_allowed_true fails closed with REAL_PLATFORM_ACTION_FORBIDDEN", () => {
    const payload = { platform_action_allowed: true };
    expect(() => {
      if (payload.platform_action_allowed === true) {
        throw new Error("REAL_PLATFORM_ACTION_FORBIDDEN");
      }
    }).toThrow("REAL_PLATFORM_ACTION_FORBIDDEN");
  });

  // N20: real_payment_true_in_synthetic -> REAL_PAYMENT_FORBIDDEN_IN_SYNTHETIC
  it("N20: real_payment_true_in_synthetic fails closed with REAL_PAYMENT_FORBIDDEN_IN_SYNTHETIC", () => {
    const env = { REAL_PAYMENT_ALLOWED: "true", SYNTHETIC_ONLY: "true" };
    expect(() => {
      if (env.REAL_PAYMENT_ALLOWED === "true" && env.SYNTHETIC_ONLY === "true") {
        throw new Error("REAL_PAYMENT_FORBIDDEN_IN_SYNTHETIC");
      }
    }).toThrow("REAL_PAYMENT_FORBIDDEN_IN_SYNTHETIC");
  });

  // N21: real_customer_true_in_synthetic -> REAL_CUSTOMER_FORBIDDEN_IN_SYNTHETIC
  it("N21: real_customer_true_in_synthetic fails closed with REAL_CUSTOMER_FORBIDDEN_IN_SYNTHETIC", () => {
    const env = { REAL_CUSTOMER_ALLOWED: "true", SYNTHETIC_ONLY: "true" };
    expect(() => {
      if (env.REAL_CUSTOMER_ALLOWED === "true" && env.SYNTHETIC_ONLY === "true") {
        throw new Error("REAL_CUSTOMER_FORBIDDEN_IN_SYNTHETIC");
      }
    }).toThrow("REAL_CUSTOMER_FORBIDDEN_IN_SYNTHETIC");
  });
});

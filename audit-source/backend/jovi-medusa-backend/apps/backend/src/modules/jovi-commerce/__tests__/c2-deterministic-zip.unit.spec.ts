import fs from "node:fs";
import path from "node:path";
import {
  buildDeliveryPackageFromManifest,
  validateRelativePath,
  assertRegularAssetFile,
  sha256,
} from "../c2-deterministic-zip";

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

describe("C2 Deterministic Delivery Package (C2_DETERMINISTIC_ZIP_V1)", () => {
  const fixtureDir = findFixtureDir();
  const manifest = JSON.parse(
    fs.readFileSync(path.join(fixtureDir, "product-manifest.json"), "utf8")
  );

  const EXPECTED_ZIP_SHA =
    "d13f5d95cc9e46bfa8a871e5a8542552a38964db1ff7fdd68cfedb83ab6623ca";
  const EXPECTED_PKG_MANIFEST_SHA =
    "382a5a016905e1d5290d599e55abf36e3a766a62ad1b10dea1a2fc5dc4d391f0";
  const EXPECTED_PROD_MANIFEST_SHA =
    "71d638c59255b6a6520ecda3c36dccd77a44e42b0dc126e4514b09b0619ffade";

  it("builds identical bytes repeatedly (Build A == Build B)", () => {
    const buildA = buildDeliveryPackageFromManifest(fixtureDir, manifest);
    const buildB = buildDeliveryPackageFromManifest(fixtureDir, manifest);

    expect(buildA.zipBuffer.equals(buildB.zipBuffer)).toBe(true);
    expect(buildA.zipSha256).toBe(buildB.zipSha256);
    expect(buildA.manifestSha256).toBe(buildB.manifestSha256);
  });

  it("matches the cloud reference test vector byte-for-byte and hash-for-hash", () => {
    const { zipBuffer, zipSha256, manifestSha256, packageManifest } =
      buildDeliveryPackageFromManifest(fixtureDir, manifest);

    expect(zipSha256).toBe(EXPECTED_ZIP_SHA);
    expect(manifestSha256).toBe(EXPECTED_PKG_MANIFEST_SHA);
    expect(packageManifest.product_manifest_sha256).toBe(EXPECTED_PROD_MANIFEST_SHA);
    expect(zipBuffer.length).toBe(2249);
  });

  it("rejects traversal and illegal path specifications", () => {
    expect(() => validateRelativePath("../escape")).toThrow(
      "DOT_OR_TRAVERSAL_SEGMENT_FORBIDDEN"
    );
    expect(() => validateRelativePath("./same")).toThrow(
      "DOT_OR_TRAVERSAL_SEGMENT_FORBIDDEN"
    );
    expect(() => validateRelativePath("/absolute/path")).toThrow(
      "ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN"
    );
    expect(() => validateRelativePath("C:/windows/drive")).toThrow(
      "ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN"
    );
    expect(() => validateRelativePath("d:\\windows\\drive")).toThrow(
      "BACKSLASH_PATH_FORBIDDEN"
    );
    expect(() => validateRelativePath("nul\0byte")).toThrow("NUL_IN_PATH");
    expect(() => validateRelativePath("")).toThrow("EMPTY_RELATIVE_PATH");
  });
});

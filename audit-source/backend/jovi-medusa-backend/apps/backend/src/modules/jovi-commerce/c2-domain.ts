import crypto from "node:crypto";
import { sha256 } from "./c2-deterministic-zip";

export interface C2ProductAsset {
  media_type: string;
  relative_path: string;
  rights_status: "original";
  sha256: string;
  size: number;
}

export interface C2ProductManifest {
  $schema?: string;
  schema_version: 1;
  product_id: string;
  name: string;
  version: string;
  owner: string;
  synthetic_only: true;
  rights_status: "original";
  prohibited_content_confirmed_absent: true;
  deliverables: string[];
  acceptance_criteria: string[];
  assets: C2ProductAsset[];
}

export interface C2DigitalRelease {
  release_id: string;
  product_id: string;
  variant_id: string;
  version: string;
  state: "DRAFT" | "READY" | "FROZEN";
  release_manifest_sha256: string;
  source_product_manifest_sha256: string;
  rights_evidence_sha256: string;
  created_at: string;
}

export interface C2DeliveryAsset {
  asset_id: string;
  release_id: string;
  relative_path: string;
  sha256: string;
  size: number;
  media_type: string;
  rights_status: "original";
  private_storage_key: string;
}

export interface C2DeliveryPackage {
  package_id: string;
  release_id: string;
  artifact_sha256: string;
  manifest_sha256: string;
  deterministic_build_id: string;
  file_count: number;
  total_bytes: number;
}

export interface C2DownloadGrant {
  grant_id: string;
  entitlement_id: string;
  order_id: string;
  package_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  synthetic_only: true;
}

export interface C2ListingCandidate {
  candidate_only: true;
  platform_action_allowed: false;
  title: string;
  description: string;
  verified_features: string[];
  version: string;
  requirements: string[];
  delivery_contents: string[];
  support_boundary: string;
  faq: Array<{ q: string; a: string }>;
  rights_statement: string;
  delivery_instructions: string;
}

export interface C2XianyuDraftBundle {
  candidate_only: true;
  platform_action_allowed: false;
  publish: false;
  send_message: false;
  deliver: false;
  change_price: false;
  refund: false;
  listing: C2ListingCandidate;
}

export function generateGrantToken(): string {
  return "c2grant_" + crypto.randomBytes(24).toString("hex");
}

export function hashGrantToken(token: string): string {
  if (!token) {
    throw new Error("EMPTY_GRANT_TOKEN");
  }
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function validateDownloadGrantAccess(params: {
  grant: C2DownloadGrant;
  token: string;
  entitlement: { entitlement_id: string; order_id: string; package_id?: string; revoked_at?: string | null };
  orderId: string;
  packageId: string;
  now?: Date;
}): void {
  const { grant, token, entitlement, orderId, packageId, now = new Date() } = params;

  if (grant.synthetic_only !== true) {
    throw new Error("SYNTHETIC_GRANT_REQUIRED");
  }
  if (grant.revoked_at !== null) {
    throw new Error("DOWNLOAD_GRANT_REVOKED");
  }
  if (entitlement.revoked_at != null) {
    throw new Error("ENTITLEMENT_REVOKED");
  }
  const expiryDate = new Date(grant.expires_at);
  if (now.getTime() >= expiryDate.getTime()) {
    throw new Error("DOWNLOAD_GRANT_EXPIRED");
  }
  if (grant.entitlement_id !== entitlement.entitlement_id) {
    throw new Error("DOWNLOAD_GRANT_ENTITLEMENT_MISMATCH");
  }
  if (grant.order_id !== orderId || entitlement.order_id !== orderId) {
    throw new Error("DOWNLOAD_GRANT_ORDER_MISMATCH");
  }
  if (grant.package_id !== packageId || (entitlement.package_id && entitlement.package_id !== packageId)) {
    throw new Error("DOWNLOAD_GRANT_PACKAGE_MISMATCH");
  }
  const computedHash = hashGrantToken(token);
  if (!timingSafeCompare(computedHash, grant.token_hash)) {
    throw new Error("DOWNLOAD_GRANT_TOKEN_MISMATCH");
  }
}

export function createListingCandidateFromManifest(manifest: C2ProductManifest): C2ListingCandidate {
  return {
    candidate_only: true,
    platform_action_allowed: false,
    title: manifest.name,
    description: `Original synthetic digital package: ${manifest.name} (version ${manifest.version}). Produced deterministically for testing and verification.`,
    verified_features: [
      "100% original synthetic fixture",
      "Deterministic delivery package format C2_DETERMINISTIC_ZIP_V1",
      "Cryptographically verified manifest SHA256",
      "Single-user digital evaluation license",
    ],
    version: manifest.version,
    requirements: [
      "Windows 10/11 or modern Linux host",
      "Standard ZIP extraction utility",
    ],
    delivery_contents: [...manifest.deliverables],
    support_boundary: "Synthetic product validation only. No commercial runtime support.",
    faq: [
      {
        q: "What is included in this package?",
        a: "Includes all deliverables specified in the product manifest: " + manifest.deliverables.join(", "),
      },
      {
        q: "How is delivery verified?",
        a: "Deterministic SHA256 matches the manifest and the DownloadGrant retrieval check.",
      },
    ],
    rights_statement: "Original synthetic intellectual property owned by " + manifest.owner + ". All rights reserved.",
    delivery_instructions: "Download via authenticated synthetic loopback endpoint using issued single-use DownloadGrant.",
  };
}

export function createXianyuDraftBundle(listing: C2ListingCandidate): C2XianyuDraftBundle {
  return {
    candidate_only: true,
    platform_action_allowed: false,
    publish: false,
    send_message: false,
    deliver: false,
    change_price: false,
    refund: false,
    listing,
  };
}

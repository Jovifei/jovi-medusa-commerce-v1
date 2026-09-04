import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const C2_PACKAGE_FORMAT = "C2_DETERMINISTIC_ZIP_V1";
const FIXED_DOS_TIME = 0; // 00:00:00
const FIXED_DOS_DATE = 0x0021; // 1980-01-01

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

export function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = sortKeys(obj[k]);
  }
  return sorted;
}

export function canonicalJsonBytes(value: any): Buffer {
  return Buffer.from(JSON.stringify(sortKeys(value), null, 2) + "\n", "utf8");
}

export function validateRelativePath(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("EMPTY_RELATIVE_PATH");
  }
  if (value.includes("\0")) {
    throw new Error("NUL_IN_PATH");
  }
  if (value.includes("\\")) {
    throw new Error("BACKSLASH_PATH_FORBIDDEN");
  }
  if (value.startsWith("/") || value.startsWith("//") || /^[A-Za-z]:/.test(value)) {
    throw new Error("ABSOLUTE_OR_DRIVE_PATH_FORBIDDEN");
  }
  const parts = value.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) {
    throw new Error("DOT_OR_TRAVERSAL_SEGMENT_FORBIDDEN");
  }
  return value;
}

export function assertRegularAssetFile(root: string, rel: string): string {
  validateRelativePath(rel);
  const target = path.join(root, rel);
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);

  if (!resolvedTarget.startsWith(resolvedRoot + path.sep) && resolvedTarget !== resolvedRoot) {
    throw new Error(`PATH_ESCAPE:${rel}`);
  }

  // Walk all path segments to ensure no symlink or junction exists
  const parts = rel.split("/");
  let current = resolvedRoot;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      const lstat = fs.lstatSync(current);
      if (lstat.isSymbolicLink()) {
        throw new Error(`SYMLINK_OR_REPARSE_FORBIDDEN:${rel}`);
      }
    } catch (e: any) {
      if (e.message.startsWith("SYMLINK_OR_REPARSE_FORBIDDEN")) throw e;
      throw new Error(`MISSING_ASSET:${rel}`);
    }
  }

  const stat = fs.statSync(resolvedTarget);
  if (!stat.isFile()) {
    throw new Error(`NOT_REGULAR_FILE:${rel}`);
  }
  return resolvedTarget;
}

export function readStableAsset(root: string, rel: string): Buffer {
  const target = assertRegularAssetFile(root, rel);
  const before = fs.statSync(target);
  const data = fs.readFileSync(target);
  const after = fs.statSync(target);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error(`ASSET_CHANGED_DURING_READ:${rel}`);
  }
  return data;
}

export interface PackageManifestAsset {
  media_type: string;
  relative_path: string;
  rights_status: "original";
  sha256: string;
  size: number;
}

export interface PackageManifest {
  schema_version: 1;
  package_format: typeof C2_PACKAGE_FORMAT;
  release_id: string;
  product_id: string;
  version: string;
  product_manifest_sha256: string;
  files: PackageManifestAsset[];
}

export function buildDeterministicZip(members: Record<string, Buffer>): Buffer {
  const fileRecords: Array<{
    nameBuf: Buffer;
    crc: number;
    size: number;
    offset: number;
  }> = [];
  let offset = 0;
  const localChunks: Buffer[] = [];

  const names = Object.keys(members).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const data = members[name];
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const size = data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4);         // version needed: 20
    localHeader.writeUInt16LE(0, 6);          // general purpose bit flag: 0
    localHeader.writeUInt16LE(0, 8);          // compression method: STORE (0)
    localHeader.writeUInt16LE(FIXED_DOS_TIME, 10);
    localHeader.writeUInt16LE(FIXED_DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // extra field length: 0

    localChunks.push(localHeader, nameBuf, data);
    fileRecords.push({ nameBuf, crc, size, offset });
    offset += localHeader.length + nameBuf.length + data.length;
  }

  const centralOffset = offset;
  const centralChunks: Buffer[] = [];
  for (const rec of fileRecords) {
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);  // central directory signature
    cdHeader.writeUInt16LE(0x0314, 4);      // version made by: 0x0314 (Unix, v2.0)
    cdHeader.writeUInt16LE(20, 6);          // version needed: 20
    cdHeader.writeUInt16LE(0, 8);           // general purpose bit flag: 0
    cdHeader.writeUInt16LE(0, 10);          // compression method: STORE (0)
    cdHeader.writeUInt16LE(FIXED_DOS_TIME, 12);
    cdHeader.writeUInt16LE(FIXED_DOS_DATE, 14);
    cdHeader.writeUInt32LE(rec.crc, 16);
    cdHeader.writeUInt32LE(rec.size, 20);
    cdHeader.writeUInt32LE(rec.size, 24);
    cdHeader.writeUInt16LE(rec.nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);          // extra field length: 0
    cdHeader.writeUInt16LE(0, 32);          // comment length: 0
    cdHeader.writeUInt16LE(0, 34);          // disk number start: 0
    cdHeader.writeUInt16LE(0, 36);          // internal file attr: 0
    cdHeader.writeUInt32LE(0x81a40000, 38); // external file attr: 0o100644 << 16 (regular file)
    cdHeader.writeUInt32LE(rec.offset, 42); // relative offset of local header

    centralChunks.push(cdHeader, rec.nameBuf);
    offset += cdHeader.length + rec.nameBuf.length;
  }

  const centralSize = offset - centralOffset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // end of central dir signature
  eocd.writeUInt16LE(0, 4);                  // number of this disk
  eocd.writeUInt16LE(0, 6);                  // disk with central dir
  eocd.writeUInt16LE(fileRecords.length, 8); // entries this disk
  eocd.writeUInt16LE(fileRecords.length, 10);// total entries
  eocd.writeUInt32LE(centralSize, 12);       // central directory size
  eocd.writeUInt32LE(centralOffset, 16);     // central directory offset
  eocd.writeUInt16LE(0, 20);                 // comment length: 0

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}

export function buildDeliveryPackageFromManifest(
  root: string,
  manifest: any
): { zipBuffer: Buffer; packageManifest: PackageManifest; zipSha256: string; manifestSha256: string } {
  if (manifest.synthetic_only !== true) {
    throw new Error("SYNTHETIC_ONLY_REQUIRED");
  }
  if (manifest.rights_status !== "original") {
    throw new Error("RIGHTS_NOT_ORIGINAL");
  }
  if (manifest.prohibited_content_confirmed_absent !== true) {
    throw new Error("PROHIBITED_CONTENT_NOT_CONFIRMED_ABSENT");
  }
  if (!manifest.deliverables || !manifest.deliverables.length) {
    throw new Error("EMPTY_DELIVERABLES");
  }
  if (!manifest.acceptance_criteria || !manifest.acceptance_criteria.length) {
    throw new Error("EMPTY_ACCEPTANCE_CRITERIA");
  }
  if (!manifest.assets || !manifest.assets.length) {
    throw new Error("EMPTY_ASSETS");
  }

  const verifiedAssets: PackageManifestAsset[] = [];
  const seen = new Set<string>();

  for (const raw of manifest.assets) {
    const rel = validateRelativePath(raw.relative_path);
    if (seen.has(rel)) {
      throw new Error(`DUPLICATE_ASSET:${rel}`);
    }
    seen.add(rel);

    const data = readStableAsset(root, rel);
    const actualSha = sha256(data);
    if (actualSha !== raw.sha256) {
      throw new Error("ASSET_SHA_MISMATCH");
    }
    if (data.length !== raw.size) {
      throw new Error("ASSET_SIZE_MISMATCH");
    }
    if (raw.rights_status !== "original") {
      throw new Error("RIGHTS_NOT_ORIGINAL");
    }

    verifiedAssets.push({
      media_type: raw.media_type,
      relative_path: rel,
      rights_status: "original",
      sha256: actualSha,
      size: data.length,
    });
  }

  // Deliverables must match assets
  const deliverableSet = new Set(manifest.deliverables);
  if (seen.size !== deliverableSet.size || ![...seen].every((x) => deliverableSet.has(x))) {
    throw new Error("DELIVERABLE_ASSET_SET_MISMATCH");
  }

  // ASCII sort of verified assets
  verifiedAssets.sort((a, b) => (a.relative_path < b.relative_path ? -1 : a.relative_path > b.relative_path ? 1 : 0));

  const prodManifestBytes = canonicalJsonBytes(manifest);
  const packageManifest: PackageManifest = {
    schema_version: 1,
    package_format: C2_PACKAGE_FORMAT,
    release_id: `rel_${manifest.product_id}_${manifest.version.replaceAll(".", "_")}`,
    product_id: manifest.product_id,
    version: manifest.version,
    product_manifest_sha256: sha256(prodManifestBytes),
    files: verifiedAssets,
  };

  const manifestBytes = canonicalJsonBytes(packageManifest);
  const members: Record<string, Buffer> = {
    "MANIFEST.json": manifestBytes,
  };
  for (const asset of verifiedAssets) {
    members[asset.relative_path] = readStableAsset(root, asset.relative_path);
  }

  const zipBuffer = buildDeterministicZip(members);
  const zipSha256 = sha256(zipBuffer);
  const manifestSha256 = sha256(manifestBytes);

  return { zipBuffer, packageManifest, zipSha256, manifestSha256 };
}

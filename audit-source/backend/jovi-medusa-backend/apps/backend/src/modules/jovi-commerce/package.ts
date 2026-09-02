import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { zipSync } from "fflate"
import type { FixtureEntry } from "./fixture"

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_PACKAGE_BYTES = 25 * 1024 * 1024
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

export type DeterministicPackage = {
  package_path: string
  manifest_path: string
  package_sha256: string
  package_manifest_sha256: string
  entries: FixtureEntry[]
}

export async function buildDeterministicPackage(root: string, allowlist: string[], outputRoot: string, sourceManifestSha256?: string): Promise<DeterministicPackage> {
  const requested = [...new Set(allowlist)]
  if (requested.length !== allowlist.length || requested.some((path) => !/^assets\/[^/]+(?:\/[^/]+)*$/.test(path))) throw new Error("INVALID_PACKAGE_ALLOWLIST")
  const entries: FixtureEntry[] = []
  const files: Record<string, Uint8Array> = {}
  let totalBytes = 0
  for (const path of requested.sort()) {
    const current = join(root, path)
    const stat = await lstat(current).catch(() => undefined)
    if (!stat || stat.isSymbolicLink() || !stat.isFile()) throw new Error("PACKAGE_FILE_MISSING_OR_REPARSE")
    const bytes = await readFile(current)
    const entry = { path, sha256: sha256(bytes), size: bytes.length }
    entries.push(entry)
    if (entry.size > MAX_FILE_BYTES) throw new Error("PACKAGE_FILE_TOO_LARGE")
    totalBytes += bytes.length
    if (totalBytes > MAX_PACKAGE_BYTES) throw new Error("PACKAGE_TOO_LARGE")
    files[entry.path] = bytes
  }

  const archive = Buffer.from(zipSync(files, { level: 0, mtime: new Date("1980-01-01T00:00:00.000Z"), os: 3, attrs: 0o100644 << 16 } as never))
  if (archive.length > MAX_PACKAGE_BYTES) throw new Error("PACKAGE_TOO_LARGE")
  const packageSha256 = sha256(archive)
  const manifest = {
    schema_version: 1,
    format: "ZIP",
    compression: "STORE",
    source_manifest_sha256: sourceManifestSha256 ?? sha256(Buffer.from(JSON.stringify(entries))),
    package_sha256: packageSha256,
    entries,
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`)
  const packageManifestSha256 = sha256(manifestBytes)
  const stagingRoot = `${outputRoot}.staging`
  const packagePath = join(outputRoot, "package.zip")
  const manifestPath = join(outputRoot, "package_manifest.json")
  const packageSidecarPath = `${packagePath}.sha256`
  const manifestSidecarPath = `${manifestPath}.sha256`
  const existing = await lstat(outputRoot).catch(() => undefined)
  if (existing?.isSymbolicLink()) throw new Error("PACKAGE_OUTPUT_REPARSE_PATH")
  await rm(stagingRoot, { recursive: true, force: true })
  await mkdir(stagingRoot, { recursive: true })
  await writeFile(join(stagingRoot, "package.zip"), archive)
  await writeFile(join(stagingRoot, "package_manifest.json"), manifestBytes)
  await writeFile(join(stagingRoot, "package.zip.sha256"), `${packageSha256}  package.zip\n`)
  await writeFile(join(stagingRoot, "package_manifest.json.sha256"), `${packageManifestSha256}  package_manifest.json\n`)
  await rm(outputRoot, { recursive: true, force: true })
  await rename(stagingRoot, outputRoot)
  return { package_path: packagePath, manifest_path: manifestPath, package_sha256: packageSha256, package_manifest_sha256: packageManifestSha256, entries }
}

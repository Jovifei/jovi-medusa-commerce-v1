import { createHash } from "node:crypto"
import { lstat, readdir, readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export type FixtureEntry = { path: string; sha256: string; size: number }

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")

export async function buildFixtureManifest(root: string, allowlist: string[]): Promise<{ entries: FixtureEntry[]; manifest_sha256: string }> {
  const expected = new Set(allowlist)
  const entries: FixtureEntry[] = []
  const visit = async (current: string) => {
    const stat = await lstat(current)
    if (stat.isSymbolicLink()) throw new Error("FIXTURE_REPARSE_PATH")
    if (stat.isDirectory()) {
      for (const name of await readdir(current)) await visit(join(current, name))
      return
    }
    const path = relative(root, current).split(sep).join("/")
    if (!expected.has(path)) throw new Error("UNKNOWN_FIXTURE_FILE")
    const bytes = await readFile(current)
    entries.push({ path, sha256: sha256(bytes), size: bytes.length })
  }
  await visit(root)
  for (const path of expected) {
    if (!entries.some((entry) => entry.path === path)) throw new Error("FIXTURE_FILE_MISSING")
  }
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  return { entries, manifest_sha256: sha256(Buffer.from(JSON.stringify(entries))) }
}

export function toMedusaMajorUnits(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("INVALID_MINOR_AMOUNT")
  if (currency.toUpperCase() !== "CNY") throw new Error("UNSUPPORTED_CURRENCY")
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`
}

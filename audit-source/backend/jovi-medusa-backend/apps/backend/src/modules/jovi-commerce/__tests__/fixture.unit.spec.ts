import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildFixtureManifest, toMedusaMajorUnits } from "../fixture"

describe("synthetic fixture boundary", () => {
  test("hashes only the declared files and rejects unknown files", async () => {
    const root = await mkdtemp(join(tmpdir(), "jovi-fixture-"))
    await mkdir(join(root, "assets"))
    await writeFile(join(root, "assets", "checklist.txt"), "synthetic checklist\n")
    const manifest = await buildFixtureManifest(root, ["assets/checklist.txt"])
    expect(manifest.entries).toHaveLength(1)
    expect(manifest.entries[0].sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(manifest.entries[0].size).toBe(20)
    await writeFile(join(root, "assets", "unknown.txt"), "unexpected\n")
    await expect(buildFixtureManifest(root, ["assets/checklist.txt"])).rejects.toThrow("UNKNOWN_FIXTURE_FILE")
  })

  test("rejects missing files and reparse paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "jovi-fixture-"))
    await mkdir(join(root, "assets"))
    await expect(buildFixtureManifest(root, ["assets/checklist.txt"])).rejects.toThrow("FIXTURE_FILE_MISSING")
    await writeFile(join(root, "assets", "checklist.txt"), "ok\n")
    const link = join(root, "assets", "link.txt")
    try {
      await symlink(join(root, "assets", "checklist.txt"), link)
      await expect(buildFixtureManifest(root, ["assets/checklist.txt", "assets/link.txt"])).rejects.toThrow("FIXTURE_REPARSE_PATH")
    } catch (error: any) {
      if (error.code !== "EPERM") throw error
    }
  })

  test("converts oracle minor units to Medusa major units", () => {
    expect(toMedusaMajorUnits(1990, "CNY")).toBe("19.90")
    expect(() => toMedusaMajorUnits(1991, "XXX")).toThrow("UNSUPPORTED_CURRENCY")
  })
})

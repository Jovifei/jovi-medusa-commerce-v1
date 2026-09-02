import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildDeterministicPackage } from "../package"

describe("deterministic digital package", () => {
  test("is independent of staging path and changes when an allowlisted byte changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "jovi-package-fixture-"))
    await mkdir(join(root, "assets", "nested"), { recursive: true })
    await writeFile(join(root, "assets", "a.txt"), "alpha")
    await writeFile(join(root, "assets", "nested", "b.txt"), "bravo")
    const outputs = await mkdtemp(join(tmpdir(), "jovi-package-outputs-"))
    const first = await buildDeterministicPackage(root, ["assets/a.txt", "assets/nested/b.txt"], join(outputs, "out-a"))
    const second = await buildDeterministicPackage(root, ["assets/a.txt", "assets/nested/b.txt"], join(outputs, "out-b"))
    expect(first.package_sha256).toBe(second.package_sha256)
    expect(first.package_manifest_sha256).toBe(second.package_manifest_sha256)
    expect(JSON.parse(await readFile(first.manifest_path, "utf8")).entries).toHaveLength(2)
    await writeFile(join(root, "assets", "a.txt"), "changed")
    const changed = await buildDeterministicPackage(root, ["assets/a.txt", "assets/nested/b.txt"], join(outputs, "out-c"))
    expect(changed.package_sha256).not.toBe(first.package_sha256)
  })
})

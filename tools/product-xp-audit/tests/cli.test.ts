import { describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"

const sdk = vi.hoisted(() => ({
  saved: [] as unknown[],
  getCalls: [] as string[],
  Products: {
    Get: vi.fn(async (id: string) => {
      sdk.getCalls.push(id)
      return { ID: id, Name: "Product", xp: JSON.stringify({ Images: [], RAI: { Managed: true, Event: "DevWorld", SourceSKU: "sku-1", SourceUrl: "https://example.test/p", SourceHash: "abc123" } }), untouched: true }
    }),
    Save: vi.fn(async (_id: string, product: unknown) => { sdk.saved.push(product) }),
    List: vi.fn(),
  },
  Configuration: { Set: vi.fn() },
}))

vi.mock("../../../apps/admin/node_modules/ordercloud-javascript-sdk/dist/index.js", () => sdk)

const { repairXpObject, repairStringifiedXp } = await import("../src/cli")

const validXp = {
  Images: [{ ThumbnailUrl: "thumb.jpg", Url: "image.jpg" }],
  RAI: { Managed: true, Event: "DevWorld", SourceSKU: "sku-1", SourceUrl: "https://example.test/p", SourceHash: "abc123" },
}

describe("repairStringifiedXp helpers", () => {
  it("repairs stringified compact xp into object xp and adds missing metadata", () => {
    const repaired = repairXpObject("p1", validXp, undefined)
    expect(repaired.xp).toMatchObject({ RAI: { Managed: true, SourceSystem: "RAI DevWorld", SourceProductID: "p1", SourceCategoryPaths: [], ScrapedAtUtc: "" } })
    expect((repaired.xp as any).RAI.SourceSKU).toBe("sku-1")
  })

  it("uses snapshot metadata when available", () => {
    const repaired = repairXpObject("p1", validXp, { source: { system: "RAI", scrapedAtUtc: "2026-06-25T00:00:00Z" }, products: [{ OcId: "p1", SourceProductId: "source-1", CategoryPaths: [["Food"], ["Utilities", "Power"]] }] })
    expect((repaired.xp as any).RAI).toMatchObject({ SourceSystem: "RAI", SourceProductID: "source-1", SourceCategoryPaths: ["Food", "Utilities > Power"], ScrapedAtUtc: "2026-06-25T00:00:00Z" })
  })

  it("does not run repair unless apply, yes, and fix flag are set", async () => {
    const result = await repairStringifiedXp({ outDir: "tmp", apiUrl: "https://api.ordercloud.io", apply: false, yes: true, fixStringifiedXp: true }, [{ ID: "p1", xp: JSON.stringify(validXp) }])
    expect(result.repaired).toBe(0)
    expect(result.scanned).toBe(1)
  })

  it("writes a full-product backup before save", async () => {
    const outDir = await fs.mkdtemp("/tmp/product-xp-audit-")
    const result = await repairStringifiedXp({ outDir, apiUrl: "https://api.ordercloud.io", token: "token", apply: true, yes: true, fixStringifiedXp: true }, [{ ID: "p1", xp: JSON.stringify(validXp) }])
    expect(result.repaired).toBe(1)
    expect(sdk.Products.Get).toHaveBeenCalledTimes(2)
    expect(sdk.Products.Save).toHaveBeenCalledTimes(1)
    const backup = await fs.readFile(`${result.backupDir}/p1.json`, "utf8")
    expect(backup).toContain('"untouched": true')
    expect(sdk.saved[0]).toMatchObject({ ID: "p1", untouched: true, xp: { RAI: { SourceProductID: "p1" } } })
  })
})

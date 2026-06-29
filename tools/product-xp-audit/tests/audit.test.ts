import { describe, expect, it } from "vitest"
import { auditProductXp } from "../src/audit"

const validXp = {
  Images: [{ ThumbnailUrl: "thumb.jpg", Url: "image.jpg" }],
  RAI: {
    Managed: true,
    SourceSystem: "rai-devworld",
    Event: "DevWorld 2026",
    SourceProductID: "source-p1",
    SourceSKU: "sku-1",
    SourceUrl: "https://example.test/p",
    SourceCategoryPaths: ["Root > Category"],
    ScrapedAtUtc: "2026-01-01T00:00:00Z",
    SourceHash: "abc123",
  },
}
const product = (xp: unknown) => ({ ID: "p1", Name: "Product 1", xp })

describe("auditProductXp", () => {
  it("accepts a valid compact RAI product xp object", () => {
    const result = auditProductXp(product(validXp))
    expect(result.issues).toEqual([])
    expect(result.normalizedXp).toEqual(validXp)
  })

  it("detects stringified compact xp and validates its parsed object", () => {
    const result = auditProductXp(product(JSON.stringify(validXp)))
    expect(result.issues).toEqual([expect.objectContaining({ xpPath: "$", issueType: "stringified xp", actualType: "string" })])
    expect(result.parsedStringifiedXp).toEqual(validXp)
    expect(result.stringifiedXpSchemaValid).toBe(true)
  })

  it("reports invalid stringified JSON without parsed repair data", () => {
    const result = auditProductXp(product('{"Images":'))
    expect(result.issues).toEqual([expect.objectContaining({ xpPath: "$", issueType: "invalid stringified xp" })])
    expect(result.parsedStringifiedXp).toBeUndefined()
    expect(result.stringifiedXpSchemaValid).toBe(false)
  })

  it("reports missing xp as a missing field with a proposed default", () => {
    const result = auditProductXp({ ID: "p1", Name: "Product 1" })
    expect(result.issues[0]).toMatchObject({ xpPath: "$", issueType: "missing field", actualType: "missing", proposedNormalizedValue: expect.objectContaining({ Images: [], RAI: expect.objectContaining({ Managed: false, SourceSystem: "", SourceCategoryPaths: [] }) }) })
  })

  it("reports lowercase thumbnailUrl/url image fields as inconsistent", () => {
    const result = auditProductXp(product({ ...validXp, Images: [{ thumbnailUrl: "thumb.jpg", url: "image.jpg" }] }))
    expect(result.issues.map((i) => `${i.issueType}:${i.xpPath}`)).toEqual(expect.arrayContaining(["unexpected field:$.Images[0].thumbnailUrl", "unexpected field:$.Images[0].url", "missing field:$.Images[0].ThumbnailUrl", "missing field:$.Images[0].Url"]))
  })

  it("reports wrong string/boolean types", () => {
    const result = auditProductXp(product({ ...validXp, RAI: { ...validXp.RAI, Managed: "true", SourceSystem: 123 } }))
    expect(result.issues.map((i) => `${i.expectedType}:${i.actualType}:${i.xpPath}`)).toEqual(expect.arrayContaining(["boolean:string:$.RAI.Managed", "string:number:$.RAI.SourceSystem"]))
  })

  it("reports unexpected legacy fields but preserves them in the proposed normalized xp", () => {
    const legacyXp = { ...validXp, Images: [{ ...validXp.Images[0], thumbnailUrl: "legacy-thumb", alt: "kept" }], RAI: { ...validXp.RAI, Pricing: { BasePrice: 1 } }, Extra: true }
    const result = auditProductXp(product(legacyXp))
    expect(result.issues.map((i) => i.xpPath)).toEqual(expect.arrayContaining(["$.Extra", "$.Images[0].thumbnailUrl", "$.Images[0].alt", "$.RAI.Pricing"]))
    expect(result.normalizedXp).toMatchObject({ Extra: true, Images: [{ alt: "kept", thumbnailUrl: "legacy-thumb" }], RAI: { Pricing: { BasePrice: 1 } } })
  })

  it("does not mutate the source xp while producing normalized output", () => {
    const xp = { ...validXp, Images: [{ ThumbnailUrl: 1, Url: "image.jpg" }], RAI: { ...validXp.RAI, SourceUrl: null } }
    const original = structuredClone(xp)
    auditProductXp(product(xp))
    expect(xp).toEqual(original)
  })

  it("detects missing compact metadata fields on stringified compact xp", () => {
    const { SourceSystem, SourceProductID, SourceCategoryPaths, ScrapedAtUtc, ...raiWithoutMetadata } = validXp.RAI
    const result = auditProductXp(product(JSON.stringify({ ...validXp, RAI: raiWithoutMetadata })))
    expect(result.issues.map((i) => `${i.issueType}:${i.xpPath}`)).toEqual(expect.arrayContaining([
      "stringified xp:$",
      "missing field:$.RAI.SourceSystem",
      "missing field:$.RAI.SourceProductID",
      "missing field:$.RAI.SourceCategoryPaths",
      "missing field:$.RAI.ScrapedAtUtc",
    ]))
  })

  it("skips non-object parsed string xp for repair", () => {
    const result = auditProductXp(product(JSON.stringify(["not", "object"])))
    expect(result.parsedStringifiedXp).toBeUndefined()
    expect(result.stringifiedXpSchemaValid).toBe(false)
  })
})

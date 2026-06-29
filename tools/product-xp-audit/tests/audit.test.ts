import { describe, expect, it } from "vitest"
import { auditProductXp } from "../src/audit"

const validXp = { Images: [{ thumbnailUrl: "thumb.jpg", url: "image.jpg", alt: "kept" }], RAI: { Source: { CategoryName: "cat", ProductUrl: "https://example.test/p" }, Pricing: { RawPriceText: "€ 1.00" } }, Extra: true }
const product = (xp: unknown) => ({ ID: "p1", Name: "Product 1", xp })

describe("auditProductXp", () => {
  it("reports missing xp as a missing field with a proposed default", () => {
    const result = auditProductXp({ ID: "p1", Name: "Product 1" })
    expect(result.issues[0]).toMatchObject({ xpPath: "$", issueType: "missing field", actualType: "missing", proposedNormalizedValue: { Images: [], RAI: { Source: { CategoryName: "", ProductUrl: "" }, Pricing: { RawPriceText: "" } } } })
  })

  it("reports null xp as a null value", () => {
    const result = auditProductXp(product(null))
    expect(result.issues[0]).toMatchObject({ xpPath: "$", issueType: "null value", actualType: "null" })
  })

  it("reports missing nested fields", () => {
    const result = auditProductXp(product({ Images: [], RAI: { Source: {}, Pricing: {} } }))
    expect(result.issues.map((i) => `${i.issueType}:${i.xpPath}`)).toEqual(expect.arrayContaining(["missing field:$.RAI.Source.CategoryName", "missing field:$.RAI.Source.ProductUrl", "missing field:$.RAI.Pricing.RawPriceText"]))
  })

  it("reports wrong primitive types and proposes safe string normalization", () => {
    const result = auditProductXp(product({ ...validXp, RAI: { ...validXp.RAI, Pricing: { RawPriceText: 123 } } }))
    expect(result.issues.find((i) => i.xpPath === "$.RAI.Pricing.RawPriceText")).toMatchObject({ issueType: "wrong type", expectedType: "string", actualType: "number", proposedNormalizedValue: "123" })
  })

  it("reports arrays vs objects", () => {
    const result = auditProductXp(product({ Images: {}, RAI: [] }))
    expect(result.issues.map((i) => `${i.issueType}:${i.xpPath}`)).toEqual(expect.arrayContaining(["wrong type:$.Images", "wrong type:$.RAI"]))
  })

  it("reports extra fields but preserves them in the proposed normalized xp", () => {
    const result = auditProductXp(product(validXp))
    expect(result.issues.map((i) => i.xpPath)).toEqual(expect.arrayContaining(["$.Extra", "$.Images[0].alt"]))
    expect(result.normalizedXp).toMatchObject({ Extra: true, Images: [{ alt: "kept" }] })
  })

  it("does not mutate the source xp while producing normalized output", () => {
    const xp = { Images: [{ thumbnailUrl: 1, url: "image.jpg" }], RAI: { Source: { ProductUrl: null }, Pricing: { RawPriceText: "€ 1.00" } } }
    const original = structuredClone(xp)
    const result = auditProductXp(product(xp))
    expect(xp).toEqual(original)
    expect(result.normalizedXp).not.toBe(xp)
  })
})

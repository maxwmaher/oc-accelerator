import { describe, expect, it } from "vitest"
import { auditProductXp } from "../src/audit"

const validXp = { Images: [{ thumbnailUrl: "thumb.jpg", url: "image.jpg" }], RAI: { Source: { CategoryName: "cat", ProductUrl: "https://example.test/p" }, Pricing: { RawPriceText: "€ 1.00" } } }
const product = (xp: unknown) => ({ ID: "p1", Name: "Product 1", xp })

describe("auditProductXp", () => {
  it("reports missing xp", () => {
    const result = auditProductXp({ ID: "p1", Name: "Product 1" })
    expect(result.issues.map((i) => i.issuePath)).toContain("$")
    expect(result.safeToApply).toBe(true)
  })
  it("reports null xp", () => {
    const result = auditProductXp(product(null))
    expect(result.issues[0]).toMatchObject({ issuePath: "$", actualType: "null" })
    expect(result.safeToApply).toBe(true)
  })
  it("reports missing nested fields", () => {
    const result = auditProductXp(product({ Images: [], RAI: { Source: {}, Pricing: {} } }))
    expect(result.issues.map((i) => i.issuePath)).toEqual(expect.arrayContaining(["$.RAI.Source.CategoryName", "$.RAI.Source.ProductUrl", "$.RAI.Pricing.RawPriceText"]))
  })
  it("reports wrong primitive types", () => {
    const result = auditProductXp(product({ ...validXp, RAI: { ...validXp.RAI, Pricing: { RawPriceText: 123 } } }))
    expect(result.issues[0]).toMatchObject({ issuePath: "$.RAI.Pricing.RawPriceText", expectedType: "string", actualType: "number", safety: "unsafe" })
  })
  it("reports arrays vs objects", () => {
    const result = auditProductXp(product({ Images: {}, RAI: [] }))
    expect(result.issues.map((i) => i.issuePath)).toEqual(expect.arrayContaining(["$.Images", "$.RAI"]))
    expect(result.safeToApply).toBe(false)
  })
  it("reports extra fields", () => {
    const result = auditProductXp(product({ ...validXp, Extra: true, RAI: { ...validXp.RAI, ExtraNested: true } }))
    expect(result.issues.map((i) => i.issuePath)).toEqual(expect.arrayContaining(["$.Extra", "$.RAI.ExtraNested"]))
  })
  it("does not report already-valid products", () => {
    expect(auditProductXp(product(validXp)).issues).toHaveLength(0)
  })
})

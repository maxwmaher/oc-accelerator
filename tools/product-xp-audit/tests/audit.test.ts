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
    Descriptions: { Card: "Card description", Full: "Full description" },
    Attributes: [{ Name: "Color", Value: "Blue" }],
    Pricing: {
      Currency: "EUR",
      RawPriceText: "€ 1.00",
      BasePrice: 1,
      UnitLabel: "each",
      VatText: "incl. VAT",
      VatRate: 0.2,
      TaxIncluded: true,
      MinQuantity: 1,
      MaxQuantity: 10,
      QuantityMultiplier: 1,
      PriceBreaks: [{ Quantity: 5, Price: 0.9 }],
      Options: [{ Name: "Size", Values: [{ Name: "Large", PriceImpact: 2 }] }],
    },
    Ordering: { Deadline: "2026-01-01", LeadTime: "2 weeks", Availability: "In stock", Notes: "Order early" },
    ScrapedAtUtc: "2026-01-01T00:00:00Z",
    SourceHash: "abc123",
  },
}
const product = (xp: unknown) => ({ ID: "p1", Name: "Product 1", xp })

describe("auditProductXp", () => {
  it("accepts a valid full RAI product xp", () => {
    const result = auditProductXp(product(validXp))
    expect(result.issues).toEqual([])
    expect(result.normalizedXp).toEqual(validXp)
  })

  it("reports missing xp as a missing field with a proposed default", () => {
    const result = auditProductXp({ ID: "p1", Name: "Product 1" })
    expect(result.issues[0]).toMatchObject({
      xpPath: "$",
      issueType: "missing field",
      actualType: "missing",
      proposedNormalizedValue: expect.objectContaining({
        Images: [],
        RAI: expect.objectContaining({ Managed: false, SourceSystem: "", SourceCategoryPaths: [], Attributes: [] }),
      }),
    })
  })

  it("reports null xp as a null value", () => {
    const result = auditProductXp(product(null))
    expect(result.issues[0]).toMatchObject({ xpPath: "$", issueType: "null value", actualType: "null" })
  })

  it("reports missing Images", () => {
    const { Images, ...xpWithoutImages } = validXp
    const result = auditProductXp(product(xpWithoutImages))
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ xpPath: "$.Images", issueType: "missing field", proposedNormalizedValue: [] })]))
  })

  it("reports lowercase thumbnailUrl/url image fields as inconsistent", () => {
    const result = auditProductXp(product({ ...validXp, Images: [{ thumbnailUrl: "thumb.jpg", url: "image.jpg" }] }))
    expect(result.issues.map((i) => `${i.issueType}:${i.xpPath}`)).toEqual(
      expect.arrayContaining(["unexpected field:$.Images[0].thumbnailUrl", "unexpected field:$.Images[0].url", "missing field:$.Images[0].ThumbnailUrl", "missing field:$.Images[0].Url"]),
    )
  })

  it("reports missing RAI.Pricing fields", () => {
    const result = auditProductXp(product({ ...validXp, RAI: { ...validXp.RAI, Pricing: { RawPriceText: "€ 1.00" } } }))
    expect(result.issues.map((i) => `${i.issueType}:${i.xpPath}`)).toEqual(
      expect.arrayContaining(["missing field:$.RAI.Pricing.Currency", "missing field:$.RAI.Pricing.BasePrice", "missing field:$.RAI.Pricing.TaxIncluded", "missing field:$.RAI.Pricing.PriceBreaks", "missing field:$.RAI.Pricing.Options"]),
    )
  })

  it("reports wrong number/string/boolean types", () => {
    const result = auditProductXp(
      product({
        ...validXp,
        RAI: { ...validXp.RAI, Managed: "true", SourceSystem: 123, Pricing: { ...validXp.RAI.Pricing, BasePrice: "1", TaxIncluded: "yes" } },
      }),
    )
    expect(result.issues.map((i) => `${i.expectedType}:${i.actualType}:${i.xpPath}`)).toEqual(
      expect.arrayContaining(["boolean:string:$.RAI.Managed", "string:number:$.RAI.SourceSystem", "number:string:$.RAI.Pricing.BasePrice", "boolean:string:$.RAI.Pricing.TaxIncluded"]),
    )
  })

  it("reports missing arrays", () => {
    const result = auditProductXp(product({ ...validXp, RAI: { ...validXp.RAI, SourceCategoryPaths: undefined, Attributes: undefined, Pricing: { ...validXp.RAI.Pricing, PriceBreaks: undefined, Options: undefined } } }))
    expect(result.issues.map((i) => `${i.issueType}:${i.xpPath}`)).toEqual(
      expect.arrayContaining(["missing field:$.RAI.SourceCategoryPaths", "missing field:$.RAI.Attributes", "missing field:$.RAI.Pricing.PriceBreaks", "missing field:$.RAI.Pricing.Options"]),
    )
  })

  it("reports unexpected legacy fields but preserves them in the proposed normalized xp", () => {
    const legacyXp = { ...validXp, Images: [{ ...validXp.Images[0], thumbnailUrl: "legacy-thumb", url: "legacy-image", alt: "kept" }], RAI: { ...validXp.RAI, Source: { CategoryName: "cat", ProductUrl: "https://example.test/p" } }, Extra: true }
    const result = auditProductXp(product(legacyXp))
    expect(result.issues.map((i) => i.xpPath)).toEqual(expect.arrayContaining(["$.Extra", "$.Images[0].thumbnailUrl", "$.Images[0].url", "$.Images[0].alt", "$.RAI.Source"]))
    expect(result.normalizedXp).toMatchObject({ Extra: true, Images: [{ alt: "kept", thumbnailUrl: "legacy-thumb" }], RAI: { Source: { CategoryName: "cat" } } })
  })

  it("does not mutate the source xp while producing normalized output", () => {
    const xp = { ...validXp, Images: [{ ThumbnailUrl: 1, Url: "image.jpg" }], RAI: { ...validXp.RAI, SourceUrl: null } }
    const original = structuredClone(xp)
    const result = auditProductXp(product(xp))
    expect(xp).toEqual(original)
    expect(result.normalizedXp).not.toBe(xp)
  })
})

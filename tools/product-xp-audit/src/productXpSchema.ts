export type SchemaNode =
  | { type: "object"; fields: Record<string, SchemaNode> }
  | { type: "array"; items: SchemaNode }
  | { type: "string" }
  | { type: "number" }
  | { type: "boolean" }

export const productXpSchema = {
  type: "object",
  fields: {
    Images: {
      type: "array",
      items: {
        type: "object",
        fields: {
          ThumbnailUrl: { type: "string" },
          Url: { type: "string" },
        },
      },
    },
    RAI: {
      type: "object",
      fields: {
        Managed: { type: "boolean" },
        SourceSystem: { type: "string" },
        Event: { type: "string" },
        SourceProductID: { type: "string" },
        SourceSKU: { type: "string" },
        SourceUrl: { type: "string" },
        SourceCategoryPaths: { type: "array", items: { type: "string" } },
        Descriptions: {
          type: "object",
          fields: {
            Card: { type: "string" },
            Full: { type: "string" },
          },
        },
        Attributes: {
          type: "array",
          items: {
            type: "object",
            fields: {
              Name: { type: "string" },
              Value: { type: "string" },
            },
          },
        },
        Pricing: {
          type: "object",
          fields: {
            Currency: { type: "string" },
            RawPriceText: { type: "string" },
            BasePrice: { type: "number" },
            UnitLabel: { type: "string" },
            VatText: { type: "string" },
            VatRate: { type: "number" },
            TaxIncluded: { type: "boolean" },
            MinQuantity: { type: "number" },
            MaxQuantity: { type: "number" },
            QuantityMultiplier: { type: "number" },
            PriceBreaks: {
              type: "array",
              items: {
                type: "object",
                fields: {
                  Quantity: { type: "number" },
                  Price: { type: "number" },
                },
              },
            },
            Options: {
              type: "array",
              items: {
                type: "object",
                fields: {
                  Name: { type: "string" },
                  Values: {
                    type: "array",
                    items: {
                      type: "object",
                      fields: {
                        Name: { type: "string" },
                        PriceImpact: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        Ordering: {
          type: "object",
          fields: {
            Deadline: { type: "string" },
            LeadTime: { type: "string" },
            Availability: { type: "string" },
            Notes: { type: "string" },
          },
        },
        ScrapedAtUtc: { type: "string" },
        SourceHash: { type: "string" },
      },
    },
  },
} as const satisfies SchemaNode

export type ProductXp = {
  Images: { ThumbnailUrl: string; Url: string }[]
  RAI: {
    Managed: boolean
    SourceSystem: string
    Event: string
    SourceProductID: string
    SourceSKU: string
    SourceUrl: string
    SourceCategoryPaths: string[]
    Descriptions: { Card: string; Full: string }
    Attributes: { Name: string; Value: string }[]
    Pricing: {
      Currency: string
      RawPriceText: string
      BasePrice: number
      UnitLabel: string
      VatText: string
      VatRate: number
      TaxIncluded: boolean
      MinQuantity: number
      MaxQuantity: number
      QuantityMultiplier: number
      PriceBreaks: { Quantity: number; Price: number }[]
      Options: { Name: string; Values: { Name: string; PriceImpact: number }[] }[]
    }
    Ordering: { Deadline: string; LeadTime: string; Availability: string; Notes: string }
    ScrapedAtUtc: string
    SourceHash: string
  }
}

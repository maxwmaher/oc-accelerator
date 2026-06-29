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
    ScrapedAtUtc: string
    SourceHash: string
  }
}

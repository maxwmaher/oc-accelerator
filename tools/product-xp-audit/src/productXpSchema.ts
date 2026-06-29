export type SchemaNode =
  | { type: "object"; fields: Record<string, SchemaNode> }
  | { type: "array"; items: SchemaNode }
  | { type: "string" }

export const productXpSchema = {
  type: "object",
  fields: {
    Images: {
      type: "array",
      items: {
        type: "object",
        fields: {
          thumbnailUrl: { type: "string" },
          url: { type: "string" },
        },
      },
    },
    RAI: {
      type: "object",
      fields: {
        Source: {
          type: "object",
          fields: {
            CategoryName: { type: "string" },
            ProductUrl: { type: "string" },
          },
        },
        Pricing: {
          type: "object",
          fields: {
            RawPriceText: { type: "string" },
          },
        },
      },
    },
  },
} as const satisfies SchemaNode

export type ProductXp = {
  Images: { thumbnailUrl: string; url: string }[]
  RAI: {
    Source: { CategoryName: string; ProductUrl: string }
    Pricing: { RawPriceText: string }
  }
}

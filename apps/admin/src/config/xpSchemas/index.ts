import { OpenAPIV3 } from "openapi-types";
import { productXp } from "./product.example";

export const schemaObject: OpenAPIV3.SchemaObject = {
  "title": "XpSchemas",
  "description": "Marketplace-specific schemas for OrderCloud resources.",
  "type": "object",
  "properties": {
    "Products": productXp,
    // "Orders":
    // "AdminUsers"
    // "UserGroups"
    // "Suppliers"
    // "Catalogs"
    // "Buyers"
    },
  }
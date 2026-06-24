import { OpenAPIV3 } from "openapi-types";

/* Follow Open API Specification
https://swagger.io/specification/ */

export const productXp : OpenAPIV3.SchemaObject = {
  "type": "object",
  "properties": {
    "Images": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ThumbnailUrl": {
            "type": "string"
          },
          "Url": {
            "type": "string"
          }
        }
      }
    },
    "RAI": {
      "type": "object",
      "properties": {
        "Managed": { "type": "boolean" },
        "SourceSystem": { "type": "string" },
        "Event": { "type": "string" },
        "SourceProductID": { "type": "string" },
        "SourceSKU": { "type": "string" },
        "SourceUrl": { "type": "string" },
        "SourceCategoryPaths": { "type": "array", "items": { "type": "array", "items": { "type": "string" } } },
        "Descriptions": { "type": "object" },
        "Attributes": { "type": "array", "items": { "type": "object" } },
        "Pricing": { "type": "object" },
        "Ordering": { "type": "object" },
        "ScrapedAtUtc": { "type": "string" },
        "SourceHash": { "type": "string" }
      }
    },
    "Tax": {
      "type": "object",
      "properties": {
        "Description": {
          "type": "string",
          "maxLength": 50
        },
        "LongDescription": {
          "type": "string",
          "maxLength": 200
        },
        "Code": {
          "type": "string"
        }
      }
    }
  }
}
import { productXpSchema, type SchemaNode } from "./productXpSchema"

export type Product = { ID: string; Name?: string; xp?: unknown; [key: string]: unknown }
export type IssueKind = "missing" | "unexpected" | "type"
export type Safety = "safe" | "unsafe"
export type XpIssue = {
  productID: string
  productName: string
  issuePath: string
  issueKind: IssueKind
  expectedType: string
  actualType: string
  currentValue: unknown
  proposedNormalizedValue: unknown
  safety: Safety
}
export type AuditResult = { issues: XpIssue[]; normalizedXp: unknown; safeToApply: boolean }

const defaults: Record<string, unknown> = {
  "$.Images": [],
  "$.Images[].thumbnailUrl": "",
  "$.Images[].url": "",
  "$.RAI.Source.CategoryName": "",
  "$.RAI.Source.ProductUrl": "",
  "$.RAI.Pricing.RawPriceText": "",
}

function actualType(value: unknown): string {
  if (value === undefined) return "missing"
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}
function expectedType(node: SchemaNode): string {
  if (node.type === "array") return "array"
  if (node.type === "object") return "object"
  return node.type
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
function defaultFor(node: SchemaNode, path: string): unknown {
  if (path in defaults) return structuredClone(defaults[path])
  if (node.type === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(node.fields)) out[key] = defaultFor(child, `${path}.${key}`)
    return out
  }
  if (node.type === "array") return []
  return ""
}
function coercePrimitive(value: unknown, node: SchemaNode, path: string, force: boolean): { value: unknown; safe: boolean } {
  if (node.type !== "string") return { value: defaultFor(node, path), safe: false }
  if (typeof value === "string") return { value, safe: true }
  if (force && (typeof value === "number" || typeof value === "boolean")) return { value: String(value), safe: true }
  return { value: defaultFor(node, path), safe: false }
}

export function auditProductXp(product: Product, options: { force?: boolean } = {}): AuditResult {
  const issues: XpIssue[] = []
  let safeToApply = true
  const name = product.Name ?? ""
  const force = options.force === true
  const add = (path: string, kind: IssueKind, node: SchemaNode, current: unknown, proposed: unknown, safe: boolean) => {
    if (!safe) safeToApply = false
    issues.push({ productID: product.ID, productName: name, issuePath: path, issueKind: kind, expectedType: expectedType(node), actualType: actualType(current), currentValue: current, proposedNormalizedValue: proposed, safety: safe ? "safe" : "unsafe" })
  }
  const visit = (value: unknown, node: SchemaNode, path: string): unknown => {
    if (value === undefined) {
      const proposed = defaultFor(node, path)
      add(path, "missing", node, value, proposed, true)
      return proposed
    }
    if (node.type === "object") {
      if (!isRecord(value)) {
        const proposed = defaultFor(node, path)
        add(path, "type", node, value, proposed, value === null || value === undefined)
        return proposed
      }
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(value)) {
        if (!(key in node.fields)) add(`${path}.${key}`, "unexpected", { type: "object", fields: {} }, value[key], undefined, true)
      }
      for (const [key, child] of Object.entries(node.fields)) out[key] = visit(value[key], child, `${path}.${key}`)
      return out
    }
    if (node.type === "array") {
      if (!Array.isArray(value)) {
        const proposed = defaultFor(node, path)
        add(path, "type", node, value, proposed, false)
        return proposed
      }
      return value.map((item, i) => visit(item, node.items, `${path}[${i}]`))
    }
    if (typeof value !== node.type) {
      const coerced = coercePrimitive(value, node, path, force)
      add(path, "type", node, value, coerced.value, coerced.safe)
      if (!coerced.safe) safeToApply = false
      return coerced.value
    }
    return value
  }
  return { issues, normalizedXp: visit(product.xp, productXpSchema, "$"), safeToApply }
}

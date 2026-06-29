import { productXpSchema, type SchemaNode } from "./productXpSchema"

export type Product = { ID: string; Name?: string; xp?: unknown; [key: string]: unknown }
export type IssueKind = "missing field" | "wrong type" | "null value" | "unexpected field" | "stringified xp" | "invalid stringified xp"
export type XpIssue = {
  productID: string
  productName: string
  xpPath: string
  issueType: IssueKind
  expectedType: string
  actualType: string
  currentValue: unknown
  proposedNormalizedValue?: unknown
}
export type AuditResult = { issues: XpIssue[]; normalizedXp: unknown; parsedStringifiedXp?: Record<string, unknown>; stringifiedXpSchemaValid?: boolean }

function defaultFor(node: SchemaNode): unknown {
  if (node.type === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(node.fields)) out[key] = defaultFor(child)
    return out
  }
  if (node.type === "array") return []
  if (node.type === "number") return 0
  if (node.type === "boolean") return false
  return ""
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
function proposedValue(value: unknown, node: SchemaNode): unknown | undefined {
  if (value === undefined || value === null) return defaultFor(node)
  return undefined
}

export function auditProductXp(product: Product): AuditResult {
  const issues: XpIssue[] = []
  const name = product.Name ?? ""
  const add = (path: string, issueType: IssueKind, node: SchemaNode, current: unknown) => {
    const proposed = proposedValue(current, node)
    issues.push({
      productID: product.ID,
      productName: name,
      xpPath: path,
      issueType,
      expectedType: issueType === "unexpected field" ? "not defined in schema" : expectedType(node),
      actualType: actualType(current),
      currentValue: current,
      ...(proposed !== undefined ? { proposedNormalizedValue: proposed } : {}),
    })
  }
  const visit = (value: unknown, node: SchemaNode, path: string, collectIssues = true): unknown => {
    const addIfCollecting = (issuePath: string, issueType: IssueKind, issueNode: SchemaNode, current: unknown) => {
      if (collectIssues) add(issuePath, issueType, issueNode, current)
    }
    if (value === undefined) {
      addIfCollecting(path, "missing field", node, value)
      return defaultFor(node)
    }
    if (value === null) {
      addIfCollecting(path, "null value", node, value)
      return defaultFor(node)
    }
    if (node.type === "object") {
      if (!isRecord(value)) {
        addIfCollecting(path, "wrong type", node, value)
        return defaultFor(node)
      }
      const out: Record<string, unknown> = { ...value }
      for (const key of Object.keys(value)) {
        if (!(key in node.fields)) addIfCollecting(`${path}.${key}`, "unexpected field", { type: "object", fields: {} }, value[key])
      }
      for (const [key, child] of Object.entries(node.fields)) out[key] = visit(value[key], child, `${path}.${key}`, collectIssues)
      return out
    }
    if (node.type === "array") {
      if (!Array.isArray(value)) {
        addIfCollecting(path, "wrong type", node, value)
        return defaultFor(node)
      }
      return value.map((item, i) => visit(item, node.items, `${path}[${i}]`, collectIssues))
    }
    if (typeof value !== node.type) {
      addIfCollecting(path, "wrong type", node, value)
      return proposedValue(value, node) ?? defaultFor(node)
    }
    return value
  }
  if (typeof product.xp === "string") {
    try {
      const parsed: unknown = JSON.parse(product.xp)
      if (isRecord(parsed)) {
        const before = issues.length
        add("$", "stringified xp", productXpSchema, product.xp)
        const normalizedXp = visit(parsed, productXpSchema, "$")
        return { issues, normalizedXp, parsedStringifiedXp: parsed, stringifiedXpSchemaValid: issues.length === before + 1 }
      }
      add("$", "wrong type", productXpSchema, product.xp)
      return { issues, normalizedXp: defaultFor(productXpSchema), stringifiedXpSchemaValid: false }
    } catch {
      add("$", "invalid stringified xp", productXpSchema, product.xp)
      return { issues, normalizedXp: defaultFor(productXpSchema), stringifiedXpSchemaValid: false }
    }
  }
  return { issues, normalizedXp: visit(product.xp, productXpSchema, "$") }
}

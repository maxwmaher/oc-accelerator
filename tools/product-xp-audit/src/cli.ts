#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { auditProductXp, type Product, type XpIssue } from "./audit"

type Args = { apply: boolean; force: boolean; touchValid: boolean; outDir: string; apiUrl: string; token?: string }
type ListPage = { Items: Product[]; Meta?: { Page: number; TotalPages: number } }

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, force: false, touchValid: false, outDir: "product-xp-audit-reports", apiUrl: process.env.ORDERCLOUD_API_URL ?? "https://api.ordercloud.io", token: process.env.ORDERCLOUD_ACCESS_TOKEN }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--apply") args.apply = true
    else if (arg === "--force") args.force = true
    else if (arg === "--touch-valid") args.touchValid = true
    else if (arg === "--out-dir") args.outDir = argv[++i]
    else if (arg === "--api-url") args.apiUrl = argv[++i]
    else if (arg === "--token") args.token = argv[++i]
    else if (arg === "--help") usage(0)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}
function usage(code: number): never {
  console.log(`Usage: npm run audit -- [--apply] [--force] [--touch-valid] [--out-dir DIR] [--api-url URL]\n\nDry-run is the default. Provide ORDERCLOUD_ACCESS_TOKEN in the environment; credentials are never read from source-controlled files.`)
  process.exit(code)
}
function requireToken(args: Args): string {
  if (!args.token) throw new Error("ORDERCLOUD_ACCESS_TOKEN is required")
  return args.token
}
async function oc<T>(args: Args, route: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${args.apiUrl.replace(/\/$/, "")}/v1${route}`, { ...init, headers: { Authorization: `Bearer ${requireToken(args)}`, "Content-Type": "application/json", ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${route} failed: ${response.status} ${await response.text()}`)
  return (await response.json()) as T
}
export async function fetchAllProducts(args: Args): Promise<Product[]> {
  const products: Product[] = []
  let page = 1
  let totalPages = 1
  do {
    const data = await oc<ListPage>(args, `/products?page=${page}&pageSize=100`)
    products.push(...data.Items)
    totalPages = data.Meta?.TotalPages ?? page
    page++
  } while (page <= totalPages)
  return products
}
function csvCell(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return `"${String(text ?? "").replace(/"/g, '""')}"`
}
async function writeReports(outDir: string, issues: XpIssue[]) {
  await fs.mkdir(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(outDir, `product-xp-audit-${stamp}.json`)
  const csvPath = path.join(outDir, `product-xp-audit-${stamp}.csv`)
  await fs.writeFile(jsonPath, JSON.stringify(issues, null, 2))
  const header = ["productID", "productName", "issuePath", "expectedType", "actualType", "currentValue", "proposedNormalizedValue"]
  const rows = issues.map((i) => [i.productID, i.productName, i.issuePath, i.expectedType, i.actualType, i.currentValue, i.proposedNormalizedValue].map(csvCell).join(","))
  await fs.writeFile(csvPath, `${header.join(",")}\n${rows.join("\n")}\n`)
  return { jsonPath, csvPath }
}
async function apply(args: Args, products: Product[], validProducts: Product[], normalized: Map<string, unknown>) {
  const backupPath = path.join(args.outDir, `product-xp-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  await fs.writeFile(backupPath, JSON.stringify(products, null, 2))
  const ids = new Set([...normalized.keys(), ...(args.touchValid ? validProducts.map((p) => p.ID) : [])])
  for (const id of ids) {
    const fresh = await oc<Product>(args, `/products/${encodeURIComponent(id)}`)
    const next = normalized.has(id) ? { ...fresh, xp: normalized.get(id) } : fresh
    await oc<Product>(args, `/products/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(next) })
  }
  return backupPath
}
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const products = await fetchAllProducts(args)
  const issues: XpIssue[] = []
  const normalized = new Map<string, unknown>()
  const valid: Product[] = []
  for (const product of products) {
    const result = auditProductXp(product, { force: args.force })
    issues.push(...result.issues)
    if (result.issues.length === 0) valid.push(product)
    else if (result.safeToApply || args.force) normalized.set(product.ID, result.normalizedXp)
  }
  const reports = await writeReports(args.outDir, issues)
  console.log(`Audited ${products.length} products; found ${issues.length} issues.`)
  console.log(`JSON report: ${reports.jsonPath}`)
  console.log(`CSV report: ${reports.csvPath}`)
  if (!args.apply) return
  const skipped = products.filter((p) => issues.some((i) => i.productID === p.ID && i.safety === "unsafe") && !args.force)
  if (skipped.length) console.log(`Skipping ${skipped.length} products with unsafe coercions. Re-run with --force to override.`)
  const backupPath = await apply(args, products, valid, normalized)
  console.log(`Backup: ${backupPath}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exit(1) })

#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { Configuration, Products, type Product as OrderCloudProduct } from "../../../apps/admin/node_modules/ordercloud-javascript-sdk/dist/index.js"
import { auditProductXp, type Product, type XpIssue } from "./audit"

type Args = { outDir: string; apiUrl: string; token?: string }
type ProductListPage = { Items: Product[]; Meta?: { Page: number; TotalPages: number } }

function parseArgs(argv: string[]): Args {
  const args: Args = {
    outDir: process.env.PRODUCT_XP_AUDIT_OUT_DIR ?? "product-xp-audit-reports",
    apiUrl: process.env.ORDERCLOUD_API_URL ?? "https://api.ordercloud.io",
    token: process.env.ORDERCLOUD_ACCESS_TOKEN,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--out-dir") args.outDir = argv[++i]
    else if (arg === "--help") usage(0)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}
function usage(code: number): never {
  console.log(`Usage: npm run audit -- [--out-dir DIR]\n\nAudit-only dry run. Reads ORDERCLOUD_ACCESS_TOKEN, ORDERCLOUD_API_URL, and optional PRODUCT_XP_AUDIT_OUT_DIR from environment variables only.`)
  process.exit(code)
}
function requireToken(args: Args): string {
  if (!args.token) throw new Error("ORDERCLOUD_ACCESS_TOKEN is required")
  return args.token
}
export async function fetchAllProducts(args: Args): Promise<Product[]> {
  Configuration.Set({ baseApiUrl: args.apiUrl.replace(/\/$/, "") })
  const products: Product[] = []
  let page = 1
  let totalPages = 1
  do {
    const data = (await Products.List<OrderCloudProduct>({ page, pageSize: 100 }, { accessToken: requireToken(args) })) as ProductListPage
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
  const header = ["productID", "productName", "xpPath", "issueType", "expectedType", "actualType", "currentValue", "proposedNormalizedValue"]
  const rows = issues.map((i) => [i.productID, i.productName, i.xpPath, i.issueType, i.expectedType, i.actualType, i.currentValue, i.proposedNormalizedValue].map(csvCell).join(","))
  await fs.writeFile(csvPath, `${header.join(",")}\n${rows.join("\n")}\n`)
  return { jsonPath, csvPath }
}
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const products = await fetchAllProducts(args)
  const issues = products.flatMap((product) => auditProductXp(product).issues)
  const reports = await writeReports(args.outDir, issues)
  console.log(`Audited ${products.length} products; found ${issues.length} issues. No OrderCloud data was changed.`)
  console.log(`JSON report: ${reports.jsonPath}`)
  console.log(`CSV report: ${reports.csvPath}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exit(1) })

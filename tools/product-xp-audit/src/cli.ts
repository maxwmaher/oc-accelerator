#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Configuration, Products, type Product as OrderCloudProduct } from "../../../apps/admin/node_modules/ordercloud-javascript-sdk/dist/index.js"
import { auditProductXp, type Product, type XpIssue } from "./audit"

type Args = { outDir: string; apiUrl: string; token?: string; apply: boolean; yes: boolean; fixStringifiedXp: boolean; snapshotPath?: string }
type ProductListPage = { Items: Product[]; Meta?: { Page: number; TotalPages: number } }
type RepairResult = { scanned: number; repaired: number; skipped: number; backupDir?: string; remainingIssues: XpIssue[]; defaulted: string[] }
type SnapshotProduct = { OcId?: string; SourceProductId?: string; CategoryPaths?: string[][] }
type Snapshot = { source?: { system?: string; scrapedAtUtc?: string }; products?: SnapshotProduct[] }
type Metadata = { SourceSystem: string; SourceProductID: string; SourceCategoryPaths: string[]; ScrapedAtUtc: string; usedDefaults: string[] }

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    outDir: process.env.PRODUCT_XP_AUDIT_OUT_DIR ?? "product-xp-audit-reports",
    apiUrl: process.env.ORDERCLOUD_API_URL ?? "https://api.ordercloud.io",
    token: process.env.ORDERCLOUD_ACCESS_TOKEN,
    apply: false,
    yes: false,
    fixStringifiedXp: false,
    snapshotPath: process.env.RAI_SNAPSHOT_PATH,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--out-dir") args.outDir = argv[++i]
    else if (arg === "--snapshot") args.snapshotPath = argv[++i]
    else if (arg === "--apply") args.apply = true
    else if (arg === "--yes") args.yes = true
    else if (arg === "--fix-stringified-xp") args.fixStringifiedXp = true
    else if (arg === "--help") usage(0)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}
function usage(code: number): never {
  console.log(`Usage: npm run audit -- [--out-dir DIR] [--snapshot PATH] [--fix-stringified-xp --apply --yes]\n\nDefault is audit-only. Repair only runs when --fix-stringified-xp, --apply, and --yes are all provided.`)
  process.exit(code)
}
function requireToken(args: Args): string {
  if (!args.token) throw new Error("ORDERCLOUD_ACCESS_TOKEN is required")
  return args.token
}
function configure(args: Args) {
  Configuration.Set({ baseApiUrl: args.apiUrl.replace(/\/$/, "") })
}
export async function fetchAllProducts(args: Args): Promise<Product[]> {
  configure(args)
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
async function loadSnapshot(args: Args): Promise<Snapshot | undefined> {
  if (!args.snapshotPath) return undefined
  try { return JSON.parse(await fs.readFile(args.snapshotPath, "utf8")) as Snapshot } catch { console.warn(`Unable to load RAI snapshot at ${args.snapshotPath}; repair will use safe defaults when needed.`); return undefined }
}
function metadataFor(productID: string, snapshot?: Snapshot): Metadata {
  const sourceProduct = snapshot?.products?.find((p) => p.OcId === productID)
  const usedDefaults: string[] = []
  const value = <T>(name: string, snapshotValue: T | undefined, fallback: T): T => {
    if (snapshotValue !== undefined && snapshotValue !== null && snapshotValue !== "") return snapshotValue
    usedDefaults.push(name)
    return fallback
  }
  return {
    SourceSystem: value("SourceSystem", snapshot?.source?.system, "RAI DevWorld"),
    SourceProductID: value("SourceProductID", sourceProduct?.SourceProductId, productID),
    SourceCategoryPaths: value("SourceCategoryPaths", sourceProduct?.CategoryPaths?.map((p) => p.join(" > ")), []),
    ScrapedAtUtc: value("ScrapedAtUtc", snapshot?.source?.scrapedAtUtc, ""),
    usedDefaults,
  }
}
export function repairXpObject(productID: string, parsedXp: Record<string, unknown>, snapshot?: Snapshot) {
  const rai = (parsedXp.RAI && typeof parsedXp.RAI === "object" && !Array.isArray(parsedXp.RAI)) ? { ...(parsedXp.RAI as Record<string, unknown>) } : {}
  const metadata = metadataFor(productID, snapshot)
  for (const key of ["SourceSystem", "SourceProductID", "SourceCategoryPaths", "ScrapedAtUtc"] as const) if (rai[key] === undefined || rai[key] === null) rai[key] = metadata[key]
  return { xp: { ...parsedXp, RAI: rai }, usedDefaults: metadata.usedDefaults }
}
export async function repairStringifiedXp(args: Args, products: Product[]): Promise<RepairResult> {
  const initialIssues = products.flatMap((product) => auditProductXp(product).issues)
  if (!(args.apply && args.yes && args.fixStringifiedXp)) return { scanned: products.length, repaired: 0, skipped: 0, remainingIssues: initialIssues, defaulted: [] }
  configure(args)
  const snapshot = await loadSnapshot(args)
  const backupDir = path.join(args.outDir, "backups", new Date().toISOString().replace(/[:.]/g, "-"))
  await fs.mkdir(backupDir, { recursive: true })
  let repaired = 0
  let skipped = 0
  const defaulted: string[] = []
  for (const product of products) {
    const result = auditProductXp(product)
    if (!result.parsedStringifiedXp) { skipped++; continue }
    const full = (await Products.Get<OrderCloudProduct>(product.ID, { accessToken: requireToken(args) })) as Product
    await fs.writeFile(path.join(backupDir, `${product.ID}.json`), JSON.stringify(full, null, 2))
    const fresh = (await Products.Get<OrderCloudProduct>(product.ID, { accessToken: requireToken(args) })) as Product
    const freshResult = auditProductXp(fresh)
    if (!freshResult.parsedStringifiedXp) { skipped++; continue }
    const repairedXp = repairXpObject(product.ID, freshResult.parsedStringifiedXp, snapshot)
    if (repairedXp.usedDefaults.length) defaulted.push(`${product.ID}: ${repairedXp.usedDefaults.join(", ")}`)
    fresh.xp = repairedXp.xp
    await Products.Save<OrderCloudProduct>(product.ID, fresh as OrderCloudProduct, { accessToken: requireToken(args) })
    repaired++
  }
  return { scanned: products.length, repaired, skipped, backupDir, remainingIssues: [], defaulted }
}
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const products = await fetchAllProducts(args)
  const issues = products.flatMap((product) => auditProductXp(product).issues)
  const reports = await writeReports(args.outDir, issues)
  const repair = await repairStringifiedXp(args, products)
  const counts = issues.reduce<Record<string, number>>((acc, issue) => { acc[issue.issueType] = (acc[issue.issueType] ?? 0) + 1; return acc }, {})
  console.log(`Audited ${products.length} products; found ${issues.length} issues. Stringified XP: ${counts["stringified xp"] ?? 0}; missing compact metadata fields: ${issues.filter((i) => i.issueType === "missing field" && i.xpPath.startsWith("$.RAI.")).length}; invalid unparseable XP: ${counts["invalid stringified xp"] ?? 0}.`)
  if (args.apply && args.yes && args.fixStringifiedXp) {
    console.log(`Repair scanned ${repair.scanned} products; repaired ${repair.repaired}; skipped ${repair.skipped}; backup path: ${repair.backupDir ?? ""}; remaining issues: ${repair.remainingIssues.length}.`)
    for (const entry of repair.defaulted) console.log(`Used safe metadata defaults for ${entry}.`)
  } else console.log("No OrderCloud data was changed.")
  console.log(`JSON report: ${reports.jsonPath}`)
  console.log(`CSV report: ${reports.csvPath}`)
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : ""
if (entryPath && fileURLToPath(import.meta.url) === entryPath) main().catch((error) => { console.error(error); process.exit(1) })

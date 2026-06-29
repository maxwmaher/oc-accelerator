# Product XP Audit

Audit-only TypeScript CLI for checking OrderCloud Product `xp` against the canonical schema in `src/productXpSchema.ts`.

## Run

```bash
ORDERCLOUD_ACCESS_TOKEN=... npm --prefix tools/product-xp-audit run audit
```

Environment variables only:

- `ORDERCLOUD_ACCESS_TOKEN` (required)
- `ORDERCLOUD_API_URL` (optional, defaults to `https://api.ordercloud.io`)
- `PRODUCT_XP_AUDIT_OUT_DIR` (optional, defaults to `product-xp-audit-reports`)

Optional CLI argument:

- `--out-dir DIR` writes JSON and CSV reports to a custom directory.

The command is dry-run/audit-only. It lists products through the OrderCloud SDK, writes JSON and CSV reports, and does not apply, save, PUT, patch, or otherwise mutate OrderCloud data.

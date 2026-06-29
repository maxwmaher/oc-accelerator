# Product XP Audit

TypeScript CLI for auditing and optionally normalizing OrderCloud Product `xp` against the canonical schema in `src/productXpSchema.ts`.

Dry-run is the default and never mutates products:

```bash
ORDERCLOUD_ACCESS_TOKEN=... npm run audit
```

Options:

- `--apply` writes changes with `PUT /Products.Save` semantics after creating a JSON backup and re-fetching every product immediately before saving.
- `--force` allows primitive coercions such as number/boolean to string. Without it, unsafe or ambiguous coercions are reported and skipped.
- `--touch-valid` re-saves products that already match the schema when `--apply` is also present, refreshing product index/cache behavior without changing `xp`.
- `--out-dir <dir>` changes where JSON/CSV reports and backups are written.
- `--api-url <url>` overrides `https://api.ordercloud.io`.

Credentials must be supplied through the environment or CLI at runtime; do not commit credentials or read them from source-controlled files.

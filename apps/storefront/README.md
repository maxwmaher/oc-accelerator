# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list

## Bristan marketplace demo scraper and seeder

The Bristan marketplace flow lives in `scripts/bristan-marketplace.mjs` and is intentionally safe to rerun. It writes a reviewable scrape artifact to `scrape-output/bristan-products.json`, keeps Product `xp` as real objects/arrays, omits `Currency` from PriceSchedule payloads, and uses Bristan-hosted image URLs directly without downloading or committing images.

### Commands

```bash
npm run bristan:scrape
npm run bristan:audit
npm run bristan:seed:dry-run
npm run bristan:seed
```

### OrderCloud environment for seeding

Set these variables before `npm run bristan:seed`:

- `OC_CLIENT_ID` and `OC_CLIENT_SECRET` for an API client with product, price schedule, catalog, and category administration roles.
- `OC_API_URL` if the marketplace does not use `https://api.ordercloud.io/v1`.
- `OC_CATALOG_ID` or `BRISTAN_CATALOG_ID` if the catalog is not `Default`.
- `BRISTAN_SCRAPE_OUTPUT` to read/write a different scrape JSON path.

If credentials are not present, `npm run bristan:seed:dry-run` validates the generated seed payloads without calling OrderCloud.

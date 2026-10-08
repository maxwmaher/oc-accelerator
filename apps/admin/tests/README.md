The admin pins `@ordercloud/react-sdk` to `0.3.0` and `react-hook-form` to
`7.53.2` as a compatible pair. The published SDK embeds its own React Hook
Form implementation in both `dist/index.js` and `dist/index.umd.cjs`. Its
`useOcForm` creates a control with `_updateDisabledField`, `_updateValid`,
`_updateFieldArray` and `_subjects.values`; npm deduplication cannot replace
this embedded implementation.

The previously locked admin dependency, React Hook Form `7.72.0`, calls
`control._setDisabledField` and `control._subscribe` when local controllers
mount. Those methods are absent from the SDK control. `7.53.2` is the SDK's
declared minimum peer version and uses the matching private control methods.
The first regression test reproduced both missing-method errors before this
alignment and passes afterward. Keep these exact pins together; run these
runtime tests before changing either package, even if the peer ranges and
TypeScript build accept a newer version.

`npm test` type-checks the tests and runs the real installed SDK, its schema
generation and resolver, the admin controls, and the production order-detail
route. It covers nested order xp, read-only and disabled fields, reader
permissions, PriceSchedule quantities/decimal prices/validation, discard,
permitted saves, promotions (including the independent expression-editor
form), and assignments. MSW intercepts API traffic and rejects unhandled
requests. The cached OpenAPI fixture and token are synthetic. No SDK or React
Hook Form hooks are mocked.

From Windows PowerShell, after updating your checkout to the merged repair,
run from the repository root with the existing admin build configuration and
Node.js 22:

```powershell
Push-Location .\apps\admin
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    npm test
    if ($LASTEXITCODE -ne 0) { throw "Admin runtime tests failed" }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Admin build failed" }
} finally {
    Pop-Location
}
```

The deployment artifact remains `apps/admin/dist`. These commands do not
merge or deploy. Existing unset `VITE_APP_NAME` and large-bundle warnings are
outside this repair.

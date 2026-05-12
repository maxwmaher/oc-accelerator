// Azure Functions app URL for storefront payment acceptance.
// Leave blank to use the current origin, which works when the storefront and Functions app
// are hosted behind the same `/api` route prefix.
export const DEMO_FUNCTIONS_BASE_URL = (
  import.meta.env.VITE_APP_STOREFRONT_FUNCTIONS_BASE_URL || ""
).replace(/\/+$/, "");

// Azure Functions app URL for storefront payment acceptance.
// Deployed storefronts must set this to the Azure Function App origin, for example:
// https://dometic-demi-api-bra2hkgufkfsa6g8.westeurope-01.azurewebsites.net
export const DEMO_FUNCTIONS_BASE_URL = (
  import.meta.env.VITE_APP_STOREFRONT_FUNCTIONS_BASE_URL || ""
).replace(/\/+$/, "");

export const DEMO_ACCEPT_PAYMENT_ROUTE = "/api/payments/accept";

export const getDemoAcceptPaymentUrl = () => {
  if (!DEMO_FUNCTIONS_BASE_URL) {
    const message =
      "VITE_APP_STOREFRONT_FUNCTIONS_BASE_URL is required for deployed payment acceptance. " +
      "Set it to the Azure Function App host, for example " +
      "https://dometic-demi-api-bra2hkgufkfsa6g8.westeurope-01.azurewebsites.net.";
    console.error(`PAYMENT_ACCEPT_DEBUG: ${message}`);
    throw new Error(message);
  }

  const baseUrlWithoutApiSuffix = DEMO_FUNCTIONS_BASE_URL.replace(/\/api$/i, "");
  return `${baseUrlWithoutApiSuffix}${DEMO_ACCEPT_PAYMENT_ROUTE}`;
};

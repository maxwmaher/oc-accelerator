// Azure Functions app URL for storefront payment acceptance.
// Deployed storefronts must set this to the Azure Function App origin, for example:
// https://dometic-demi-api-bra2hkgufkfsa6g8.westeurope-01.azurewebsites.net
export const DEMO_FUNCTIONS_BASE_URL = (
  import.meta.env.VITE_APP_STOREFRONT_FUNCTIONS_BASE_URL || ""
).replace(/\/+$/, "");

export const DEMO_ACCEPT_PAYMENT_ROUTE = "/api/payments/accept";

export const getDemoAcceptPaymentUrl = () => {
  if (!DEMO_FUNCTIONS_BASE_URL) {
    console.warn("PAYMENT_FLOW_DEBUG: missing functions base URL, cannot call acceptpayment");
    return null;
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(DEMO_FUNCTIONS_BASE_URL);
  } catch {
    console.warn("PAYMENT_FLOW_DEBUG: missing functions base URL, cannot call acceptpayment", {
      configuredBaseUrl: DEMO_FUNCTIONS_BASE_URL,
    });
    return null;
  }

  if (!/^https?:$/.test(parsedBaseUrl.protocol)) {
    console.warn("PAYMENT_FLOW_DEBUG: missing functions base URL, cannot call acceptpayment", {
      configuredBaseUrl: DEMO_FUNCTIONS_BASE_URL,
    });
    return null;
  }

  const baseUrlWithoutApiSuffix = DEMO_FUNCTIONS_BASE_URL.replace(/\/api$/i, "");
  return `${baseUrlWithoutApiSuffix}${DEMO_ACCEPT_PAYMENT_ROUTE}`;
};

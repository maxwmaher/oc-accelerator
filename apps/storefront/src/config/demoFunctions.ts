// Public Azure Functions app URL used by the demo storefront payment acceptance flow.
// This host is intentionally hard-coded for the demo so deployed storefronts do not
// require extra deployment environment setup just to accept a demo payment.
export const DEMO_FUNCTIONS_BASE_URL =
  "https://dometic-demi-api-bra2hkgufkfsa6g8.westeurope-01.azurewebsites.net";

export const DEMO_ACCEPT_PAYMENT_ROUTE = "/api/payments/accept";

export const getDemoAcceptPaymentUrl = () => {
  const baseUrlWithoutApiSuffix = DEMO_FUNCTIONS_BASE_URL.replace(/\/api$/i, "").replace(/\/+$/, "");
  return `${baseUrlWithoutApiSuffix}${DEMO_ACCEPT_PAYMENT_ROUTE}`;
};

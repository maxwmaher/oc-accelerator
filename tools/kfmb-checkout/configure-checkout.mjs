#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const target = Object.freeze({
  api: "https://westeurope-sandbox.ordercloud.io", marketplace: "_nfhvLBeikC2yF1a6f6v0w",
  verificationPriceSchedule: "kfmb-demo-flour-sa-standard",
  middlewareClient: "0BAD0F65-D294-448E-8819-98F713696BB9",
  storefrontClients: ["31FC66C6-15F6-49D4-86AE-B611ED584EB4", "57D4DE3B-255E-44E2-B9B4-AEBED7DF70A2"],
  functionsUrl: "https://gzdear-api-zz2d3twpf7h5c.azurewebsites.net",
});

export function configuration(targetConfig, hashKey) {
  const integrationBase = `${targetConfig.functionsUrl}/api/integrationevent`;
  return {
    integrationBase,
    callbackUrls: {
      OrderCalculate: `${integrationBase}/OrderCalculate`,
      OrderSubmit: `${integrationBase}/OrderSubmit`,
    },
    integration: { ID: "kfmb-pickup-checkout", Name: "KFMB pickup checkout", EventType: "OrderCheckout", CustomImplementationUrl: integrationBase, HashKey: hashKey },
    webhook: { ID: "kfmb-validate-submit-quantity", Name: "KFMB validate checkout quantities", Description: "Signed before-request validation for explicit and cart submission", Url: `${targetConfig.functionsUrl}/api/webhooks/validate-order-submit`, HashKey: hashKey, BeforeProcessRequest: true, ElevatedRoles: ["Shopper"], ApiClientIDs: targetConfig.storefrontClients, WebhookRoutes: [{ Route: "v1/orders/{direction}/{orderID}/submit", Verb: "POST" }, { Route: "v1/cart/submit", Verb: "POST" }] },
  };
}

export async function run({ apply = false, secret, hashKey, fetchImpl = fetch, targetConfig = target, log = console.log } = {}) {
  if (!secret || !hashKey) throw new Error("ORDERCLOUD_MIDDLEWARE_CLIENT_SECRET and KFMB_CHECKOUT_HASH_KEY are required (values are never printed).");
  const tokenResponse = await fetchImpl(`${targetConfig.api}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: targetConfig.middlewareClient, client_secret: secret, scope: "FullAccess" }) });
  if (!tokenResponse.ok) throw new Error(`Authentication failed (HTTP ${tokenResponse.status}).`);
  const token = (await tokenResponse.json()).access_token;
  async function request(method, path, body, { allowNotFound = false } = {}) {
    const response = await fetchImpl(`${targetConfig.api}/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { throw new Error(`${method} ${path} returned an invalid JSON response; secrets were not logged.`); }
    }
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error(`${method} ${path} failed (HTTP ${response.status}); secrets were not logged.`);
    return data;
  }

  // aud is the OrderCloud API audience, not marketplace identity. Verify a known, existing
  // marketplace-owned resource before evaluating or performing any configuration writes.
  const schedule = await request("GET", `/priceschedules/${targetConfig.verificationPriceSchedule}`);
  if (schedule?.OwnerID !== targetConfig.marketplace)
    throw new Error("Known price schedule is not owned by the expected KFMB Demo marketplace; no writes were performed.");
  const expectedClients = [targetConfig.middlewareClient, ...targetConfig.storefrontClients];
  const clients = await Promise.all(expectedClients.map(id => request("GET", `/apiclients/${id}`)));
  if (clients.some((client, index) => client?.ID !== expectedClients[index]))
    throw new Error("Expected API client verification failed; no writes were performed.");

  const config = configuration(targetConfig, hashKey);
  log(`${apply ? "APPLY" : "DRY RUN"}: verified the target marketplace resource and three API clients.`);
  log(`Planned OrderCheckout callbacks: ${config.callbackUrls.OrderCalculate} and ${config.callbackUrls.OrderSubmit}.`);
  log("Planned writes: checkout integration, two API-client associations, and submission webhook. No live callbacks or checkout were tested.");
  if (!apply) { log("No writes performed. Re-run with --apply after Functions is deployed."); return; }
  const existingIntegration = await request("GET", `/integrationevents/${config.integration.ID}`, undefined, { allowNotFound: true });
  const existingWebhook = await request("GET", `/webhooks/${config.webhook.ID}`, undefined, { allowNotFound: true });
  await request("PUT", `/integrationevents/${config.integration.ID}`, { ...existingIntegration, ...config.integration });
  for (const client of clients.slice(1)) await request("PATCH", `/apiclients/${client.ID}`, { OrderCheckoutIntegrationEventID: config.integration.ID });
  await request("PUT", `/webhooks/${config.webhook.ID}`, { ...existingWebhook, ...config.webhook });
  log("Checkout configuration applied. No catalog, user, group, price, or promotion resources were touched; callbacks were not invoked by this script.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run({ apply: process.argv.includes("--apply"), secret: process.env.ORDERCLOUD_MIDDLEWARE_CLIENT_SECRET, hashKey: process.env.KFMB_CHECKOUT_HASH_KEY });
}

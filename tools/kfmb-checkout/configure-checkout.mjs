#!/usr/bin/env node
const target = Object.freeze({
  api: "https://westeurope-sandbox.ordercloud.io", marketplace: "_nfhvLBeikC2yF1a6f6v0w",
  middlewareClient: "0BAD0F65-D294-448E-8819-98F713696BB9",
  storefrontClients: ["31FC66C6-15F6-49D4-86AE-B611ED584EB4", "57D4DE3B-255E-44E2-B9B4-AEBED7DF70A2"],
  functionsUrl: "https://gzdear-api-zz2d3twpf7h5c.azurewebsites.net",
});
const apply = process.argv.includes("--apply");
const secret = process.env.ORDERCLOUD_MIDDLEWARE_CLIENT_SECRET;
const hashKey = process.env.KFMB_CHECKOUT_HASH_KEY;
if (!secret || !hashKey) throw new Error("ORDERCLOUD_MIDDLEWARE_CLIENT_SECRET and KFMB_CHECKOUT_HASH_KEY are required (values are never printed).");
const tokenResponse = await fetch(`${target.api}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: target.middlewareClient, client_secret: secret, scope: "FullAccess" }) });
if (!tokenResponse.ok) throw new Error(`Authentication failed (HTTP ${tokenResponse.status}).`);
const token = (await tokenResponse.json()).access_token;
const jwt = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
const marketplaceClaim = jwt.marketplace_id || jwt.marketplaceID || jwt.aud;
if (Array.isArray(marketplaceClaim) ? !marketplaceClaim.includes(target.marketplace) : marketplaceClaim !== target.marketplace)
  throw new Error("Authenticated token is not for the expected KFMB Demo marketplace.");
async function request(method, path, body) {
  const response = await fetch(`${target.api}/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text(); const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} failed (HTTP ${response.status}); secrets were not logged.`);
  return data;
}
const clients = await Promise.all([target.middlewareClient, ...target.storefrontClients].map(id => request("GET", `/apiclients/${id}`)));
if (clients.some((client, index) => client.ID !== [target.middlewareClient, ...target.storefrontClients][index])) throw new Error("Expected API client verification failed.");
const integration = { ID: "kfmb-pickup-checkout", Name: "KFMB pickup checkout", EventType: "OrderCheckout", CustomImplementationUrl: `${target.functionsUrl}/api/integrationevent`, HashKey: hashKey };
const webhook = { ID: "kfmb-validate-submit-quantity", Name: "KFMB validate checkout quantities", Description: "Signed before-request validation for explicit and cart submission", Url: `${target.functionsUrl}/api/webhooks/validate-order-submit`, HashKey: hashKey, BeforeProcessRequest: true, ApiClientIDs: target.storefrontClients, WebhookRoutes: [{ Route: "v1/orders/{direction}/{orderID}/submit", Verb: "POST" }, { Route: "v1/cart/submit", Verb: "POST" }] };
console.log(`${apply ? "APPLY" : "DRY RUN"}: checkout integration, two API-client associations, and submission webhook verified for ${target.marketplace}.`);
if (!apply) { console.log("No writes performed. Re-run with --apply after Functions is deployed."); process.exit(0); }
await request("PUT", `/integrationevents/${integration.ID}`, integration);
for (const client of clients.slice(1)) await request("PATCH", `/apiclients/${client.ID}`, { OrderCheckoutIntegrationEventID: integration.ID });
await request("PUT", `/webhooks/${webhook.ID}`, webhook);
console.log("Checkout configuration applied. No catalog, user, group, price, or promotion resources were touched.");

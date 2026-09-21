import assert from "node:assert/strict";
import test from "node:test";
import { configuration, run, target } from "../configure-checkout.mjs";

const response = (status, value, empty = false) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => value,
  text: async () => empty ? "" : JSON.stringify(value),
});

function fakeFetch({ owner = target.marketplace, clientOverride } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, ...init });
    if (url.endsWith("/oauth/token"))
      // aud intentionally is an API URL. The script must never use it as marketplace identity.
      return response(200, { access_token: "header.eyJhdWQiOiJodHRwczovL3dlc3RldXJvcGUtc2FuZGJveC5vcmRlcmNsb3VkLmlvIn0.signature" });
    if (url.includes("/priceschedules/")) return response(200, { ID: target.verificationPriceSchedule, OwnerID: owner });
    const id = decodeURIComponent(url.split("/").at(-1));
    if (init.method === "GET" && url.includes("/apiclients/")) return response(200, { ID: clientOverride ?? id });
    return response(204, null, true);
  };
  return { calls, fetchImpl };
}

test("forms the exact predefined callback URLs from the integration base", () => {
  const config = configuration(target, "not-printed");
  assert.equal(config.integration.CustomImplementationUrl, `${target.functionsUrl}/api/integrationevent`);
  assert.deepEqual(config.callbackUrls, {
    OrderCalculate: `${target.functionsUrl}/api/integrationevent/OrderCalculate`,
    OrderSubmit: `${target.functionsUrl}/api/integrationevent/OrderSubmit`,
  });
});

test("preserves both storefront clients and grants only Shopper elevation to both submit routes", () => {
  const webhook = configuration(target, "not-printed").webhook;
  assert.deepEqual(webhook.ElevatedRoles, ["Shopper"]);
  assert.deepEqual(webhook.ApiClientIDs, target.storefrontClients);
  assert.equal(webhook.BeforeProcessRequest, true);
  assert.deepEqual(webhook.WebhookRoutes, [
    { Route: "v1/orders/{direction}/{orderID}/submit", Verb: "POST" },
    { Route: "v1/cart/submit", Verb: "POST" },
  ]);
});

test("merges unrelated existing webhook properties while enforcing checkout permissions", async () => {
  const fake = fakeFetch();
  const baseFetch = fake.fetchImpl;
  fake.fetchImpl = async (url, init = {}) => {
    if (init.method === "GET" && url.endsWith("/webhooks/kfmb-validate-submit-quantity"))
      return response(200, { ID: "kfmb-validate-submit-quantity", UnrelatedSetting: "keep-me", ElevatedRoles: ["FullAccess"] });
    if (init.method === "GET" && url.endsWith("/integrationevents/kfmb-pickup-checkout")) return response(404, {});
    return baseFetch(url, init);
  };
  await run({ apply: true, secret: "secret", hashKey: "hash", fetchImpl: fake.fetchImpl, log() {} });
  const put = fake.calls.find(call => call.method === "PUT" && call.url.includes("/webhooks/"));
  const body = JSON.parse(put.body);
  assert.equal(body.UnrelatedSetting, "keep-me");
  assert.deepEqual(body.ElevatedRoles, ["Shopper"]);
});

test("verifies marketplace ownership when JWT aud is the API URL", async () => {
  const fake = fakeFetch();
  await run({ secret: "secret", hashKey: "hash", fetchImpl: fake.fetchImpl, log() {} });
  assert.equal(fake.calls.filter(call => call.method === "PUT" || call.method === "PATCH").length, 0);
});

test("rejects wrong resource ownership before configuration writes", async () => {
  const fake = fakeFetch({ owner: "another-marketplace" });
  await assert.rejects(() => run({ apply: true, secret: "secret", hashKey: "hash", fetchImpl: fake.fetchImpl, log() {} }), /not owned/);
  assert.equal(fake.calls.filter(call => call.method === "PUT" || call.method === "PATCH").length, 0);
});

test("rejects a wrong API client before configuration writes", async () => {
  const fake = fakeFetch({ clientOverride: "wrong-client" });
  await assert.rejects(() => run({ apply: true, secret: "secret", hashKey: "hash", fetchImpl: fake.fetchImpl, log() {} }), /API client verification/);
  assert.equal(fake.calls.filter(call => call.method === "PUT" || call.method === "PATCH").length, 0);
});

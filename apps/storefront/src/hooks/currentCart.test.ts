import assert from "node:assert/strict";
import test from "node:test";
import { isNoCurrentCartError, resolveCurrentCartState } from "../utils/kfmbCurrentCartState.ts";

const noCart = {
  status: 404,
  errorCode: "NotFound",
  response: { config: { url: "/cart/worksheet" }, status: 404 },
};

test("recognizes only OrderCloud's worksheet-specific no-current-cart response", () => {
  assert.equal(isNoCurrentCartError(noCart), true);
  assert.equal(isNoCurrentCartError({ ...noCart, errorCode: "MissingResource" }), false);
  assert.equal(isNoCurrentCartError({ ...noCart, response: { config: { url: "/me/products/nope" } } }), false);
  assert.equal(isNoCurrentCartError({ ...noCart, status: 403 }), false);
});

test("models authentication, loading, no-cart, empty and populated carts", () => {
  assert.equal(resolveCurrentCartState(false, false, false, undefined, null).status, "auth-pending");
  assert.equal(resolveCurrentCartState(true, true, true, undefined, null).status, "loading");
  assert.deepEqual(resolveCurrentCartState(true, true, false, undefined, noCart), { status: "empty", lineItems: [] });
  const empty = resolveCurrentCartState(true, true, false, { Order: { ID: "o1" }, LineItems: [] }, null);
  assert.equal(empty.status, "ready");
  const populated = resolveCurrentCartState(true, true, false, {
    Order: { ID: "o1" }, LineItems: [{ ID: "l1", ProductID: "p1", Quantity: 5 }],
  }, null);
  assert.equal(populated.status, "ready");
  assert.equal(populated.status === "ready" && populated.lineItems[0].Quantity, 5);
});

test("does not turn failures or malformed successful responses into an empty cart", () => {
  for (const error of [
    new Error("Network unavailable"),
    { status: 401 }, { status: 403 }, { status: 500 },
    { ...noCart, response: { config: { url: "/orders/Outgoing/missing" } } },
  ]) assert.equal(resolveCurrentCartState(true, true, false, undefined, error).status, "error");

  for (const response of [
    undefined, {}, { Order: { ID: "o1" } }, { Order: {}, LineItems: "bad" },
    { Order: { ID: "o1" }, LineItems: [{ ProductID: "p1" }] },
  ]) {
    assert.equal(resolveCurrentCartState(true, true, false, response as never, null).status, "error");
  }
});

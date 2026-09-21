import assert from "node:assert/strict";
import test from "node:test";
import { resolveCurrentCartState } from "../utils/kfmbCurrentCartState.ts";
import { emptyPdpQuantityState, resolvePdpQuantityState } from "../utils/kfmbPdpQuantityState.ts";
import { productQuantity } from "../utils/kfmbQuantityRules.ts";

// Exact HTTP 200 response observed from GET /v1/cart/worksheet for a shopper
// who has no current order. Keep this fixture faithful to the API boundary.
const successfulEmptyWorksheet = {
  Order: null,
  LineItems: null,
  OrderPromotions: null,
  Subscription: null,
  ShipEstimateResponse: null,
  OrderCalculateResponse: null,
  OrderSubmitResponse: null,
  OrderSubmitForApprovalResponse: null,
  OrderApprovedResponse: null,
  SubscriptionIntegrationResponse: null,
};

test("adapts the real successful empty worksheet response", () => {
  assert.deepEqual(resolveCurrentCartState(true, true, false, successfulEmptyWorksheet, null), {
    status: "empty", lineItems: [],
  });
});

test("keeps unresolved, malformed, and inconsistent responses distinct from empty", () => {
  assert.equal(resolveCurrentCartState(false, false, false, undefined, null).status, "auth-pending");
  assert.equal(resolveCurrentCartState(true, true, true, undefined, null).status, "loading");

  for (const response of [
    undefined, null, {}, { Order: null }, { LineItems: null },
    { Order: null, LineItems: [{ ID: "l1", ProductID: "p1", Quantity: 5 }] },
    { Order: { ID: "o1" } }, { Order: {}, LineItems: "bad" },
    { Order: { ID: "o1" }, LineItems: [{ ProductID: "p1" }] },
    { Order: { ID: "o1" }, LineItems: [{ ProductID: "p1", Quantity: 0 }] },
  ]) {
    assert.equal(resolveCurrentCartState(true, true, false, response, null).status, "error");
  }
});

test("retains persisted order identity and valid populated lines", () => {
  const emptyOrder = resolveCurrentCartState(true, true, false, { Order: { ID: "o1" }, LineItems: [] }, null);
  assert.equal(emptyOrder.status, "ready");
  assert.equal(emptyOrder.status === "ready" && emptyOrder.worksheet.Order?.ID, "o1");

  const populated = resolveCurrentCartState(true, true, false, {
    Order: { ID: "o2" },
    LineItems: [
      { ID: "l1", ProductID: "p1", Quantity: 5 },
      { ID: "l2", ProductID: "p1", Quantity: 2 },
    ],
  }, null);
  assert.equal(populated.status, "ready");
  assert.equal(populated.status === "ready" && productQuantity(populated.lineItems, "p1"), 7);
});

test("request failures win over cached empty data and are never converted to empty", () => {
  for (const error of [
    new Error("Network unavailable"), { status: 401 }, { status: 403 }, { status: 404 }, { status: 500 },
  ]) {
    assert.equal(resolveCurrentCartState(true, true, false, successfulEmptyWorksheet, error).status, "error");
  }
});

test("empty worksheet unlocks PDP minimum initialization for each resolved shopper schedule", () => {
  const cart = resolveCurrentCartState(true, true, false, successfulEmptyWorksheet, null);
  assert.equal(cart.status, "empty");

  const wholesale = resolvePdpQuantityState(
    emptyPdpQuantityState(), "kfmb-sa-wholesale:p1:wholesale", cart.status === "empty", 5,
  );
  const standard = resolvePdpQuantityState(
    emptyPdpQuantityState(), "standard:p1:standard", cart.status === "empty", 1,
  );
  assert.deepEqual(wholesale, {
    contextKey: "kfmb-sa-wholesale:p1:wholesale", quantity: 5, initialized: true,
  });
  assert.equal(standard.quantity, 1);
});

test("a refreshed worksheet replaces empty derived state with the created cart", () => {
  const before = resolveCurrentCartState(true, true, false, successfulEmptyWorksheet, null);
  const after = resolveCurrentCartState(true, true, false, {
    Order: { ID: "created-order" },
    LineItems: [{ ID: "line-1", ProductID: "p1", Quantity: 5 }],
  }, null);
  assert.equal(before.status, "empty");
  assert.equal(after.status, "ready");
  assert.equal(after.status === "ready" && after.worksheet.Order?.ID, "created-order");
  assert.deepEqual(after.status === "ready" && after.lineItems.map(({ ProductID, Quantity }) => ({ ProductID, Quantity })), [
    { ProductID: "p1", Quantity: 5 },
  ]);
});

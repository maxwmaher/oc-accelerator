import assert from "node:assert/strict";
import test from "node:test";
import {
  canAddPdpQuantity,
  editPdpQuantityState,
  emptyPdpQuantityState,
  resolvePdpQuantityState,
} from "./kfmbPdpQuantityState.ts";

test("does not permit add-to-cart while loading or invalid", () => {
  assert.equal(canAddPdpQuantity(false), false);
  assert.equal(canAddPdpQuantity(true, "Enter a valid quantity."), false);
  assert.equal(canAddPdpQuantity(true), true);
});

test("waits for product rules and cart in either response order", () => {
  for (const intermediate of [
    { key: undefined, ready: false, minimum: undefined },
    { key: "wholesale:p1:ps", ready: false, minimum: 5 },
  ]) {
    let state = emptyPdpQuantityState();
    state = resolvePdpQuantityState(state, intermediate.key, intermediate.ready, intermediate.minimum);
    assert.equal(state.initialized, false);
    assert.equal(Number.isNaN(state.quantity), true);
    state = resolvePdpQuantityState(state, "wholesale:p1:ps", true, 5);
    assert.deepEqual(state, { contextKey: "wholesale:p1:ps", quantity: 5, initialized: true });
  }
});

test("uses each resolved schedule minimum", () => {
  const standard = resolvePdpQuantityState(emptyPdpQuantityState(), "standard:p1:ps", true, 1);
  const wholesale = resolvePdpQuantityState(emptyPdpQuantityState(), "wholesale:p1:ps", true, 5);
  assert.equal(standard.quantity, 1);
  assert.equal(wholesale.quantity, 5);
});

test("keeps edits across an equivalent refetch, including a temporarily blank input", () => {
  let state = resolvePdpQuantityState(emptyPdpQuantityState(), "u1:p1:ps", true, 5);
  state = editPdpQuantityState(state, "u1:p1:ps", 8);
  assert.strictEqual(resolvePdpQuantityState(state, "u1:p1:ps", true, 5), state);
  state = editPdpQuantityState(state, "u1:p1:ps", Number.NaN);
  assert.strictEqual(resolvePdpQuantityState(state, "u1:p1:ps", true, 5), state);
});

test("does not expose quantity from another product or shopper while loading", () => {
  const oldState = resolvePdpQuantityState(emptyPdpQuantityState(), "u1:p1:ps1", true, 5);
  const loading = resolvePdpQuantityState(oldState, "u2:p1:ps2", false, 1);
  assert.equal(loading.initialized, false);
  assert.equal(Number.isNaN(loading.quantity), true);
  assert.equal(resolvePdpQuantityState(loading, "u2:p1:ps2", true, 1).quantity, 1);
});

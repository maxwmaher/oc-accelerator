import assert from "node:assert/strict";
import test from "node:test";
import { productQuantity, quantityBounds, quantityError } from "./kfmbQuantityRules.ts";

const cumulative = { MinQuantity: 5, MaxQuantity: 50, UseCumulativeQuantity: true };

test("aggregates every matching product line and calculates remaining allowance", () => {
  const lines = [
    { ID: "a", ProductID: "p1", Quantity: 20 },
    { ID: "b", ProductID: "p1", Quantity: 28 },
    { ID: "c", ProductID: "p2", Quantity: 9 },
  ];
  const existing = productQuantity(lines, "p1");
  assert.equal(existing, 48);
  assert.deepEqual(quantityBounds(cumulative, existing), {
    minimum: 5, maximum: 50, offset: 48, entryMin: 1, entryMax: 2,
  });
  assert.equal(quantityError(cumulative, 1, existing), undefined);
  assert.equal(quantityError(cumulative, 2, existing), undefined);
  assert.match(quantityError(cumulative, 3, existing)!, /Maximum quantity/);
  assert.equal(quantityBounds(cumulative, 50).entryMax, 0);
});

test("rejects blank, fractional, and restricted quantities", () => {
  assert.match(quantityError(cumulative, Number.NaN, 0)!, /positive whole number/);
  assert.match(quantityError(cumulative, 5.5, 0)!, /positive whole number/);
  assert.equal(quantityError({ ...cumulative, RestrictedQuantity: true,
    PriceBreaks: [{ Quantity: 5 }, { Quantity: 10 }] }, 6, 0),
    "Select one of the quantities allowed by this price schedule.");
});

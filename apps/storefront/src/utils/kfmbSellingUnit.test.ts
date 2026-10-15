import assert from "node:assert/strict";
import test from "node:test";
import { sellingUnit } from "./kfmbSellingUnit.ts";

test("uses the catalog's bag, bundle, and carton selling units without converting them", () => {
  for (const singular of ["bag", "bundle", "carton"]) {
    const result = sellingUnit({ xp: { SellingUnit: singular, PackSize: "5 kg", UnitsPerMultipack: singular === "bag" ? 1 : 2 } });
    assert.equal(result.singular, singular);
    assert.equal(result.plural, `${singular}s`);
    assert.equal(result.detail, singular === "bag" ? "5 kg bag" : `2 × 5 kg ${singular}`);
  }
});

test("recognizes Saudi unit-of-measure metadata and preserves the original label", () => {
  assert.deepEqual(sellingUnit({ xp: { UnitOfMeasure: "One 1 kg pack", PackSize: "1 kg" } }), {
    singular: "pack", plural: "packs", detail: "One 1 kg pack",
  });
  assert.equal(sellingUnit({ xp: { UnitOfMeasure: "50 kg bag" } }).singular, "bag");
});

test("keeps explicit selling unit authoritative and falls back to neutral units", () => {
  assert.equal(sellingUnit({ xp: { SellingUnit: "carton", UnitOfMeasure: "One carton: 10 × 1 kg pack" } }).singular, "carton");
  assert.equal(sellingUnit({ xp: { PackSize: "1 kg" } }).singular, "unit");
  assert.deepEqual(sellingUnit(), { singular: "unit", plural: "units", detail: undefined });
});

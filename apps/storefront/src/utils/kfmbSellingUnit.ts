interface ProductUnitSource {
  xp?: Record<string, unknown>;
}

/** Describes the complete catalog selling unit without converting quantity or price. */
export function sellingUnit(product?: ProductUnitSource) {
  const xp = product?.xp;
  const measure = typeof xp?.UnitOfMeasure === "string" ? xp.UnitOfMeasure.trim() : undefined;
  const configured = typeof xp?.SellingUnit === "string" ? xp.SellingUnit.trim().toLowerCase() : undefined;
  const supported = ["bag", "carton", "bundle", "pack", "bottle", "unit"];
  const singular = configured && supported.includes(configured)
    ? configured
    : supported.find(unit => new RegExp(`\\b${unit}\\b`, "i").test(measure || "")) || "unit";
  const packSize = typeof xp?.PackSize === "string" ? xp.PackSize.trim() : undefined;
  const count = typeof xp?.UnitsPerMultipack === "number" && Number.isInteger(xp.UnitsPerMultipack) && xp.UnitsPerMultipack > 0
    ? xp.UnitsPerMultipack : undefined;
  const detail = measure || (packSize ? count && count > 1 ? `${count} × ${packSize} ${singular}` : `${packSize} ${singular}` : undefined);
  return { singular, plural: `${singular}s`, detail };
}

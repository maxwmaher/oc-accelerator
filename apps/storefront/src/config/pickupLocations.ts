import { ACTIVE_COUNTRY_CODE, COUNTRY_SELECTION_ENABLED } from "./country";

export type PickupCountry = "SA" | "KW";
export interface PickupLocation { id: string; country: PickupCountry; label: string; }
// Application-owned display configuration only. No supplier address or opening hours are implied.
export const PICKUP_LOCATIONS: Record<PickupCountry, PickupLocation> = {
  SA: { id: "sa-demo-pickup", country: "SA", label: "Saudi Arabia demo pickup point" },
  KW: { id: "kw-demo-pickup", country: "KW", label: "Kuwait demo pickup point" },
};
export const DEFAULT_PICKUP_LOCATION = PICKUP_LOCATIONS.SA;

export const ACTIVE_PICKUP_LOCATION = COUNTRY_SELECTION_ENABLED ? PICKUP_LOCATIONS[ACTIVE_COUNTRY_CODE === "kw" ? "KW" : "SA"] : DEFAULT_PICKUP_LOCATION;

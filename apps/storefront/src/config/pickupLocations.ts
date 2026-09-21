export type PickupCountry = "SA" | "KW";
export interface PickupLocation { id: string; country: PickupCountry; label: string; }
// Application-owned display configuration only. No supplier address or opening hours are implied.
export const PICKUP_LOCATIONS: Record<PickupCountry, PickupLocation> = {
  SA: { id: "sa-demo-pickup", country: "SA", label: "Saudi Arabia demo pickup point" },
  KW: { id: "kw-demo-pickup", country: "KW", label: "Kuwait demo pickup point" },
};
export const DEFAULT_PICKUP_LOCATION = PICKUP_LOCATIONS.SA;

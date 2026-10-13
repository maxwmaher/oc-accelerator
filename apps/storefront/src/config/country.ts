import publicConfig from "./kfmbPublicConfig.json";
import { resolveCountryUrl, type CountryCode } from "../utils/kfmbCountryState";

export const COUNTRY_SELECTION_ENABLED = import.meta.env.VITE_APP_KFMB_COUNTRY_SELECTION === "true";
const base = (import.meta.env.VITE_APP_CONFIG_BASE || "").replace(/\/$/, "");
const resolved = resolveCountryUrl(new URL(window.location.href), base);
export const ACTIVE_COUNTRY_CODE = resolved.country;
export const ACTIVE_COUNTRY = publicConfig.storefronts[ACTIVE_COUNTRY_CODE];
export const COUNTRY_API_URL = publicConfig.apiBaseURL;
export const ROUTER_BASENAME = COUNTRY_SELECTION_ENABLED ? resolved.basename : (base || undefined);
export const COUNTRY_CANONICAL_URL = resolved.url;
export const countryEntryUrl = (country: CountryCode) => `${base}/${country}/`;

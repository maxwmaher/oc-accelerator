export type CountryCode = "kw" | "sa";
export interface CountryConfig {
  clientID: string; buyerID: string; catalogID: string; currency: string;
  localeID: string; scope: string; demoUsernames: string[];
}
export const countryName = (country: CountryCode) => country === "kw" ? "Kuwait" : "Saudi Arabia";
export const isCountry = (value: string | null | undefined): value is CountryCode => value === "kw" || value === "sa";

/** Country paths are canonical. Query entry links and legacy paths are normalized once before routing. */
export function resolveCountryUrl(url: URL, base = "") {
  const basePath = base.replace(/\/$/, "");
  const relative = url.pathname.slice(basePath.length).replace(/^\//, "");
  const segments = relative.split("/");
  const pathCountry = isCountry(segments[0]) ? segments.shift() as CountryCode : undefined;
  const queryCountry = url.searchParams.get("country");
  const country = pathCountry || (isCountry(queryCountry) ? queryCountry : "sa");
  url.searchParams.delete("country");
  url.pathname = `${basePath}/${country}/${segments.join("/")}`;
  return { country, url, basename: `${basePath}/${country}` };
}

export function assertCountryToken(token: string, config: CountryConfig): void {
  try {
    const payload = token.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (claims.usrtype !== "buyer" || claims.cid?.toLowerCase() !== config.clientID.toLowerCase() || claims.orderid) {
      throw new Error("mismatch");
    }
  } catch {
    throw new Error("This shopper session does not match the selected country. Sign in again with a shopper account for this country.");
  }
}

export function shopperMatchesCountry(user: { Buyer?: { ID?: string }; CompanyID?: string }, config: CountryConfig): boolean {
  return user.Buyer?.ID === config.buyerID && (!user.CompanyID || user.CompanyID === config.buyerID);
}

const SESSION_PREFIX = "kfmb.storefront.session.";
const CONTEXT_KEY = "kfmb.storefront.country";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function clearCountrySessions(storage: Store): void {
  for (const country of ["kw", "sa"]) storage.removeItem(`${SESSION_PREFIX}${country}`);
}

/** Tokens belong to this tab. A country change invalidates tab sessions, never server carts or shared cookies. */
export function createCountryTokenStore(storage: Store, country: CountryCode, config: CountryConfig) {
  if (storage.getItem(CONTEXT_KEY) !== country) clearCountrySessions(storage);
  storage.setItem(CONTEXT_KEY, country);
  const key = `${SESSION_PREFIX}${country}`;
  let tokens: Record<string, string> = {};
  try {
    const stored = JSON.parse(storage.getItem(key) || "{}");
    if (stored.access) {
      assertCountryToken(stored.access, config);
      tokens = { access: stored.access, ...(typeof stored.refresh === "string" ? { refresh: stored.refresh } : {}) };
    }
  } catch { storage.removeItem(key); }
  const save = () => storage.setItem(key, JSON.stringify(tokens));
  return {
    get: (name: string) => tokens[name],
    set: (name: string, value: string) => {
      if (name === "access") {
        try { assertCountryToken(value, config); }
        catch (error) { tokens = {}; storage.removeItem(key); throw error; }
      }
      tokens[name] = value; save();
    },
    remove: (name: string) => { delete tokens[name]; save(); },
    clear: () => { tokens = {}; clearCountrySessions(storage); },
  };
}

/** react-sdk 0.3.0 hardcodes this shared cache key. Do not restore or persist it in country mode.
 * API schemas stay in memory too: the SDK otherwise deletes every shared OcOpenApi entry.
 * All other localStorage operations (including admin data) retain their original behavior. */
export function withoutSharedSdkCache(storage: Storage): Storage {
  const cacheKey = "REACT_QUERY_OFFLINE_CACHE";
  const schemas = new Map<string, string>();
  const isSchema = (key: string) => key.startsWith("OcOpenApi.");
  return new Proxy(storage, {
    get(target, property) {
      if (property === "getItem") return (key: string) => key === cacheKey ? null : isSchema(key) ? schemas.get(key) ?? null : target.getItem(key);
      if (property === "setItem") return (key: string, value: string) => { if (isSchema(key)) schemas.set(key, value); else if (key !== cacheKey) target.setItem(key, value); };
      if (property === "removeItem") return (key: string) => { if (isSchema(key)) schemas.delete(key); else if (key !== cacheKey && !key.includes("OcOpenApi")) target.removeItem(key); };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

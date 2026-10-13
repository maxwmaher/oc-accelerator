import { Tokens } from "ordercloud-javascript-sdk";
import { ACTIVE_COUNTRY, ACTIVE_COUNTRY_CODE, COUNTRY_CANONICAL_URL, COUNTRY_SELECTION_ENABLED } from "./country";
import { createCountryTokenStore, withoutSharedSdkCache } from "../utils/kfmbCountryState";

/** Run before dynamically importing AppProvider/react-sdk, whose persister captures localStorage at module evaluation. */
export function initializeCountryRuntime(): void {
  if (!COUNTRY_SELECTION_ENABLED) return;
  const store = createCountryTokenStore(window.sessionStorage, ACTIVE_COUNTRY_CODE, ACTIVE_COUNTRY);
  Tokens.GetAccessToken = () => store.get("access");
  Tokens.SetAccessToken = (value) => store.set("access", value);
  Tokens.RemoveAccessToken = () => store.remove("access");
  Tokens.GetRefreshToken = () => store.get("refresh");
  Tokens.SetRefreshToken = (value) => store.set("refresh", value);
  Tokens.RemoveRefreshToken = () => store.remove("refresh");
  // No impersonation, SSO, or shared cookie credentials may enter the selected shopper session.
  Tokens.GetImpersonationToken = Tokens.GetIdentityToken = Tokens.GetIdpAccessToken = () => undefined;
  Tokens.SetImpersonationToken = Tokens.SetIdentityToken = Tokens.SetIdpAccessToken = () => { throw new Error("Only country shopper login is supported."); };
  Tokens.RemoveImpersonationToken = Tokens.RemoveIdentityToken = Tokens.RemoveIdpAccessToken = () => {};
  Object.defineProperty(window, "localStorage", { configurable: true, value: withoutSharedSdkCache(window.localStorage) });
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
  window.history.replaceState(window.history.state, "", COUNTRY_CANONICAL_URL);
}

import assert from "node:assert/strict";
import test from "node:test";
import { assertCountryToken, clearCountrySessions, createCountryTokenStore, resolveCountryUrl, shopperMatchesCountry, withoutSharedSdkCache, type CountryConfig } from "./kfmbCountryState.ts";
import { formatCurrencyAmount } from "./kfmbCurrency.ts";
import { isCartActionInProgress, runCartAction, subscribeCartActions } from "./kfmbCartEdits.ts";

const config = (country: string): CountryConfig => ({ clientID: `${country}-client`, buyerID: `${country}-buyers`, catalogID: `${country}-catalog`, currency: country === "kw" ? "KWD" : "SAR", localeID: country, scope: "Shopper", demoUsernames: [] });
const token = (country: string, extras = {}) => `header.${btoa(JSON.stringify({ cid: `${country}-client`, usrtype: "buyer", exp: 9999999999, ...extras }))}.signature`;
function storage(): Storage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); }, clear: () => values.clear(), get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null };
}

test("both country entry links normalize to persistent country paths; legacy URLs retain Saudi", () => {
  for (const country of ["kw", "sa"]) {
    const entry = resolveCountryUrl(new URL(`https://store.test/?country=${country}`));
    assert.equal(entry.country, country);
    assert.equal(entry.url.pathname, `/${country}/`);
    const product = resolveCountryUrl(new URL(`https://store.test/${country}/products/p1?page=2`));
    assert.equal(product.country, country);
    assert.equal(product.url.search, "?page=2");
    assert.equal(product.basename, `/${country}`);
  }
  assert.equal(resolveCountryUrl(new URL("https://store.test/products/p1")).url.pathname, "/sa/products/p1");
  assert.equal(resolveCountryUrl(new URL("https://store.test/?country=https://evil.test&clientID=other")).country, "sa");
  assert.equal(resolveCountryUrl(new URL("https://store.test/kw/cart?country=sa")).country, "kw");
  assert.equal(resolveCountryUrl(new URL("https://store.test/store/?country=kw"), "/store/").url.pathname, "/store/kw/");
});

test("country sessions survive refresh, require new login after switch, and do not modify other tabs/admin", () => {
  const tabA = storage(), tabB = storage();
  tabA.setItem("admin", "unchanged");
  const sa = createCountryTokenStore(tabA, "sa", config("sa"));
  sa.set("access", token("sa")); sa.set("refresh", "sa-refresh");
  assert.equal(createCountryTokenStore(tabA, "sa", config("sa")).get("access"), token("sa"));
  const kw = createCountryTokenStore(tabB, "kw", config("kw"));
  kw.set("access", token("kw"));
  clearCountrySessions(tabA);
  assert.equal(createCountryTokenStore(tabA, "kw", config("kw")).get("access"), undefined);
  assert.equal(createCountryTokenStore(tabA, "sa", config("sa")).get("access"), undefined);
  assert.equal(kw.get("access"), token("kw"));
  assert.equal(tabA.getItem("admin"), "unchanged");
});

test("wrong client, anonymous, non-buyer, malformed token, and wrong buyer are rejected", () => {
  for (const invalid of [token("sa"), token("kw", { usrtype: "admin" }), token("kw", { orderid: "anon-order" }), "broken"]) {
    assert.throws(() => assertCountryToken(invalid, config("kw")), /does not match/);
    const vault = createCountryTokenStore(storage(), "kw", config("kw"));
    vault.set("access", token("kw"));
    assert.throws(() => vault.set("access", invalid));
    assert.equal(vault.get("access"), undefined);
  }
  assert.equal(shopperMatchesCountry({ Buyer: { ID: "kw-buyers" }, CompanyID: "kw-buyers" }, config("kw")), true);
  assert.equal(shopperMatchesCountry({ Buyer: { ID: "sa-buyers" } }, config("kw")), false);
  assert.equal(shopperMatchesCountry({}, config("kw")), false);
  const corrupt = storage();
  corrupt.setItem("kfmb.storefront.country", "kw");
  corrupt.setItem("kfmb.storefront.session.kw", JSON.stringify({ access: token("sa"), refresh: "wrong" }));
  assert.equal(createCountryTokenStore(corrupt, "kw", config("kw")).get("refresh"), undefined);
});

test("SDK shared cache is never restored or written, while unrelated storage remains accessible", () => {
  const original = storage();
  original.setItem("REACT_QUERY_OFFLINE_CACHE", "old-country-catalog-and-cart");
  original.setItem("admin", "keep");
  original.setItem("OcOpenApi.admin-url", "admin-schema");
  const adapter = withoutSharedSdkCache(original);
  assert.equal(adapter.getItem("REACT_QUERY_OFFLINE_CACHE"), null);
  adapter.setItem("REACT_QUERY_OFFLINE_CACHE", "new-country-data");
  adapter.removeItem("REACT_QUERY_OFFLINE_CACHE");
  assert.equal(original.getItem("REACT_QUERY_OFFLINE_CACHE"), "old-country-catalog-and-cart");
  adapter.removeItem("OcOpenApi.admin-url");
  assert.equal(original.getItem("OcOpenApi.admin-url"), "admin-schema");
  assert.equal(adapter.getItem("admin"), "keep");
  adapter.setItem("other", "value");
  assert.equal(original.getItem("other"), "value");
});

test("currency uses the authoritative code with Kuwait and Saudi precision without conversion", () => {
  assert.match(formatCurrencyAmount(1.234, "KWD"), /KWD.*1\.234/);
  assert.match(formatCurrencyAmount(1.234, "SAR"), /SAR.*1\.23/);
  assert.match(formatCurrencyAmount(0, "KWD"), /0\.000/);
  assert.match(formatCurrencyAmount(0, "SAR"), /0\.00/);
});

test("country switch lock covers the entire asynchronous cart/payment action and releases on failure", async () => {
  let finish!: () => void;
  const changes: boolean[] = [];
  const unsubscribe = subscribeCartActions(() => changes.push(isCartActionInProgress()));
  const pending = runCartAction(() => new Promise<void>((resolve) => { finish = resolve; }));
  assert.equal(isCartActionInProgress(), true);
  await assert.rejects(runCartAction(async () => {}), /still in progress/);
  finish(); await pending;
  assert.deepEqual(changes, [true, false]);
  await assert.rejects(runCartAction(async () => { throw new Error("payment failed"); }), /payment failed/);
  assert.equal(isCartActionInProgress(), false);
  unsubscribe();
});

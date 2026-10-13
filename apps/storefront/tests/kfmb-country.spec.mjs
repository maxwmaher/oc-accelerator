import { test, expect } from '@playwright/test';
import publicConfig from '../src/config/kfmbPublicConfig.json' with { type: 'json' };

const api = publicConfig.apiBaseURL;
const checkoutOrigins = new Set(['https://checkout.mock', 'https://gzdear-api-zz2d3twpf7h5c.azurewebsites.net']);
const list = (Items) => ({ Items, Meta: { Page: 1, PageSize: 100, TotalCount: Items.length, TotalPages: 1, Facets: [] } });
const operation = (operationId, parameters = []) => ({
  operationId, parameters, responses: { '200': { description: 'Mock response', content: { 'application/json': { schema: { type: 'object' } } } } },
});
const spec = {
  openapi: '3.0.0', info: { title: 'Mock shopper API', version: '1.0.0' }, servers: [{ url: `${api}/v1` }],
  components: { schemas: {} }, paths: {
    '/me/catalogs': { get: operation('Me.ListCatalogs') },
    '/me/categories': { get: operation('Me.ListCategories') },
    '/me/products': { get: operation('Me.ListProducts') },
    '/me/products/{productID}': { get: operation('Me.GetProduct', [{ name: 'productID', in: 'path', required: true }]) },
  },
};
const jwt = (country, username, overrides = {}) => `header.${Buffer.from(JSON.stringify({ cid: publicConfig.storefronts[country].clientID, usrtype: 'buyer', usr: username, exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })).toString('base64url')}.signature`;

async function mockShopper(context, legacy = false) {
  const requests = [], errors = [], orders = new Map(), issuedTokens = new Map(), invalidBuyers = new Set();
  let releaseMutation, holdMutation;
  const product = (country, username) => ({
    ID: `${country}-flour`, Name: `${country.toUpperCase()} flour`, Description: 'Mock assigned country product',
    PriceSchedule: { ID: `${country}-schedule`, Currency: publicConfig.storefronts[country].currency,
      MinQuantity: username.includes('wholesale') ? 5 : 1, MaxQuantity: 50,
      PriceBreaks: [{ Quantity: 1, Price: country === 'kw' ? 0.525 : 2.75 }] },
  });
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:4173') return route.continue();
    if (url.origin !== api && !checkoutOrigins.has(url.origin)) {
      errors.push(`Unmocked host: ${url.origin}`); return route.abort();
    }
    const path = url.pathname.toLowerCase(), method = request.method();
    const entry = { url: url.href, path, method, body: request.postData(), authorization: request.headers().authorization };
    requests.push(entry);
    const reply = (json, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json), headers: { 'access-control-allow-origin': '*' } });
    if (method === 'OPTIONS') return reply({});
    if (path === '/oauth/token') {
      const form = new URLSearchParams(request.postData());
      const country = Object.entries(publicConfig.storefronts).find(([, config]) => config.clientID === form.get('client_id'))?.[0];
      if (!country) { errors.push('Incorrect storefront client'); return reply({}, 400); }
      const username = form.get('username') || 'refresh-shopper';
      if (username === 'bad-password') return reply({ Errors: [{ Message: 'Invalid login' }] }, 401);
      const tokenKey = `${country}:${username}`;
      if (!issuedTokens.has(tokenKey)) issuedTokens.set(tokenKey, jwt(country, username, username === 'wrong-client' ? { cid: publicConfig.storefronts[country === 'kw' ? 'sa' : 'kw'].clientID } : {}));
      return reply({ access_token: issuedTokens.get(tokenKey), refresh_token: `refresh-${country}`, token_type: 'bearer' });
    }
    if (path === '/env') return reply({ BuildNumber: '1.0.0' });
    if (path === '/v1/openapi/v3') return reply(spec);
    let claims;
    try { claims = JSON.parse(Buffer.from(entry.authorization?.split('.')[1], 'base64url').toString()); } catch { errors.push(`Missing shopper token: ${path}`); return reply({}, 401); }
    const country = Object.entries(publicConfig.storefronts).find(([, config]) => config.clientID === claims.cid)?.[0];
    if (!country) { errors.push(`Invalid token client: ${path}`); return reply({}, 403); }
    const config = publicConfig.storefronts[country], username = claims.usr;
    const key = `${country}:${username}`, current = orders.get(key);
    const item = product(country, username);
    const worksheet = () => current?.Order.IsSubmitted ? { Order: null, LineItems: null, OrderPromotions: null } : current || { Order: null, LineItems: null, OrderPromotions: null };
    if (path === '/v1/me') return reply({ ID: username, Username: username, FirstName: country.toUpperCase(), LastName: 'Shopper', Email: 'mock@example.test', Buyer: { ID: (username === 'wrong-buyer' || invalidBuyers.has(username)) ? 'other-buyers' : config.buyerID }, CompanyID: config.buyerID });
    if (path === '/v1/me/catalogs') return reply(list([{ ID: config.catalogID, Name: `${country} catalog` }]));
    if (path === '/v1/me/categories') return reply(list([]));
    if (path === '/v1/me/products') {
      if (!legacy && url.searchParams.get('catalogId') !== config.catalogID) errors.push('Wrong country catalog filter');
      return reply(list([item]));
    }
    if (path === `/v1/me/products/${item.ID}`) return reply(item);
    if (path === '/v1/cart/worksheet') return reply(worksheet());
    if (path === '/v1/cart/lineitems' && method === 'POST') {
      const data = request.postDataJSON();
      const order = { ID: `${country}-${username}-order`, Currency: config.currency, IsSubmitted: false, Subtotal: data.Quantity * item.PriceSchedule.PriceBreaks[0].Price, PromotionDiscount: 0, ShippingCost: 0, TaxCost: 0, xp: {} };
      order.Total = order.Subtotal;
      const line = { ID: 'line-1', ProductID: item.ID, Product: { ID: item.ID, Name: item.Name }, Quantity: data.Quantity, UnitPrice: item.PriceSchedule.PriceBreaks[0].Price, LineSubtotal: order.Subtotal, LineTotal: order.Subtotal };
      orders.set(key, { Order: order, LineItems: [line], OrderPromotions: [] }); return reply(line);
    }
    if (path.startsWith('/v1/orders/outgoing/')) {
      if (!current || !path.startsWith(`/v1/orders/outgoing/${current.Order.ID.toLowerCase()}`)) { errors.push('Wrong country order'); return reply({}, 404); }
      if (path.endsWith('/lineitems')) return reply(list(current.LineItems));
      if (path.endsWith('/calculate')) return reply(current);
      if (method === 'PATCH') {
        if (holdMutation) { await holdMutation; holdMutation = undefined; }
        Object.assign(current.Order, request.postDataJSON()); return reply(current.Order);
      }
      if (method === 'GET') return reply(current.Order);
    }
    if (path === '/v1/cart/appliedpromotions' || path === '/v1/cart/eligiblepromotions') return reply(list([]));
    if (path === '/v1/cart/applypromotions') return reply(current);
    if (path === '/v1/cart/submit') { current.Order.IsSubmitted = true; return reply(current); }
    if (path.endsWith('/status') && checkoutOrigins.has(url.origin)) return reply({ status: current.Order.IsSubmitted ? 'submitted' : 'unsubmitted', orderID: current.Order.ID });
    if (path.endsWith('/payment') && checkoutOrigins.has(url.origin)) {
      if (holdMutation) { await holdMutation; holdMutation = undefined; }
      const body = request.postDataJSON();
      if (body.currency !== current.Order.Currency) errors.push('Wrong payment currency');
      return reply({ status: body.outcome === 'approve' ? 'approved' : body.outcome === 'decline' ? 'declined' : 'cancelled', amount: body.amount, currency: body.currency });
    }
    errors.push(`Unmocked request: ${method} ${path}`); return reply({}, 404);
  });
  return { requests, errors, orders, invalidBuyers, holdNextMutation() { holdMutation = new Promise((resolve) => { releaseMutation = resolve; }); }, releaseMutation() { releaseMutation?.(); } };
}
async function login(page, username) {
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('mock-only-password');
  await page.getByRole('button', { name: 'Login', exact: true }).last().click();
}

test.describe('country selection enabled', () => {
  test.skip(process.env.KFMB_COUNTRY_DISABLED === 'true', 'Run against the country-enabled build');

for (const country of ['kw', 'sa']) {
  test(`${country}: login, catalog/product links, cart, saved pickup, payment and persisted confirmation`, async ({ page, context }) => {
    const mock = await mockShopper(context), pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`/?country=${country}`);
    await expect(page).toHaveURL(new RegExp(`/${country}/$`));
    await expect(page.getByLabel('Shopping country')).toHaveValue(country);
    await expect(page.getByRole('heading', { name: /Login Required/ })).toBeVisible();
    await login(page, `kfmb-${country}-wholesale`);
    await page.getByRole('link', { name: 'Shop All Products' }).click();
    await expect(page).toHaveURL(new RegExp(`/${country}/shop/${country}-catalog/products$`));
    await expect(page.getByText(country === 'kw' ? /KWD.*0\.525/ : /SAR.*2\.75/)).toBeVisible();
    await page.getByRole('link', { name: new RegExp(`${country.toUpperCase()} flour`) }).click();
    await expect(page).toHaveURL(new RegExp(`/${country}/products/${country}-flour$`));
    const add = page.getByRole('button', { name: /Add.*cart/i });
    await expect(add).toBeEnabled();
    await expect(page.getByRole('spinbutton')).toHaveValue('5');
    await add.click();
    await expect(page).toHaveURL(new RegExp(`/${country}/cart$`));
    await expect(page.getByText(country === 'kw' ? 'Kuwait demo pickup point' : 'Saudi Arabia demo pickup point', { exact: true })).toBeVisible();
    const existingCart = mock.orders.get(`${country}:kfmb-${country}-wholesale`);
    existingCart.Order.xp.KFMBCheckout = { Pickup: { LocationID: 'other-country-pickup', Country: country === 'kw' ? 'SA' : 'KW', Label: 'Old pickup' } };
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Payment and review' })).toBeDisabled();
    mock.holdNextMutation();
    await page.getByRole('button', { name: 'Save pickup details and review' }).click();
    await expect(page.getByLabel('Shopping country')).toBeDisabled();
    mock.releaseMutation();
    await expect(page.getByRole('heading', { name: 'Payment and review' })).toBeVisible();
    await expect(page.getByLabel('Shopping country')).toBeEnabled();
    const order = mock.orders.get(`${country}:kfmb-${country}-wholesale`).Order;
    expect(order.xp.KFMBCheckout.Pickup).toMatchObject({ LocationID: `${country}-demo-pickup`, Country: country.toUpperCase(), Label: country === 'kw' ? 'Kuwait demo pickup point' : 'Saudi Arabia demo pickup point' });
    // Simulate an order's persisted data differing from the active display fallback.
    order.Currency = country === 'kw' ? 'SAR' : 'KWD';
    order.xp.KFMBCheckout.Pickup.Label = 'Persisted pickup label';
    mock.holdNextMutation();
    await page.getByRole('button', { name: 'Approve and submit order' }).click();
    await expect(page.getByLabel('Shopping country')).toBeDisabled();
    mock.releaseMutation();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${country}/order-confirmation\\?orderID=`));
    await expect(page.getByText('Persisted pickup label', { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`Fulfillment: Pickup.*${order.Currency}.*0\\.${order.Currency === 'KWD' ? '000' : '00'}`))).toBeVisible();
    await expect(page.locator('#lineItemRow').getByText(new RegExp(order.Currency)).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    expect(mock.errors).toEqual([]); expect(pageErrors).toEqual([]);
  });
}

test('country switches reauthenticate without cart writes, preserve other tabs and unrelated browser storage', async ({ context, page }) => {
  const mock = await mockShopper(context);
  await context.addCookies([{ name: `${publicConfig.storefronts.sa.clientID}.access-token`, value: jwt('sa', 'old-cookie-shopper'), domain: '127.0.0.1', path: '/' }]);
  await context.addInitScript(() => {
    localStorage.setItem('admin-settings', 'preserve');
    localStorage.setItem('OcOpenApi.admin-url', 'preserve-admin-schema');
    localStorage.setItem('REACT_QUERY_OFFLINE_CACHE', JSON.stringify({ timestamp: Date.now(), buster: '', clientState: { queries: [{ queryKey: ['currentUser'], queryHash: '["currentUser"]', state: { data: { FirstName: 'POISON' }, status: 'success', dataUpdatedAt: Date.now() } }], mutations: [] } }));
  });
  await page.goto('/?country=sa');
  await expect(page.getByRole('heading', { name: /Login Required/ })).toBeVisible();
  await login(page, 'kfmb-sa-standard');
  await expect(page.getByText('Welcome, SA Shopper')).toBeVisible();
  await page.goto('/sa/products/sa-flour');
  await expect(page.getByRole('button', { name: /Add.*cart/i })).toBeEnabled();
  await page.getByRole('button', { name: /Add.*cart/i }).click();
  await expect(page).toHaveURL(/\/sa\/cart$/);
  const saOrderBefore = JSON.stringify(mock.orders.get('sa:kfmb-sa-standard'));
  const otherTab = await context.newPage();
  await otherTab.goto('/?country=kw');
  await login(otherTab, 'kfmb-kw-standard');
  await expect(otherTab.getByText('Welcome, KW Shopper')).toBeVisible();
  await otherTab.goto('/kw/products/kw-flour');
  await expect(otherTab.getByRole('button', { name: /Add.*cart/i })).toBeEnabled();
  await otherTab.getByRole('button', { name: /Add.*cart/i }).click();
  await expect(otherTab).toHaveURL(/\/kw\/cart$/);
  const kwOrderBefore = JSON.stringify(mock.orders.get('kw:kfmb-kw-standard'));
  const before = mock.requests.length;
  await page.getByLabel('Shopping country').selectOption('kw');
  await expect(page).toHaveURL(/\/kw\/$/);
  await expect(page.getByRole('heading', { name: /Login Required/ })).toBeVisible();
  expect(mock.requests.slice(before).filter((request) => request.method !== 'GET' && request.method !== 'OPTIONS')).toEqual([]);
  await expect(otherTab.getByText('Welcome, KW Shopper')).toBeVisible();
  await otherTab.reload();
  await expect(otherTab.getByText('Welcome, KW Shopper')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('admin-settings'))).toBe('preserve');
  expect(JSON.stringify(mock.orders.get('sa:kfmb-sa-standard'))).toBe(saOrderBefore);
  expect(JSON.stringify(mock.orders.get('kw:kfmb-kw-standard'))).toBe(kwOrderBefore);
  expect(await context.storageState()).toMatchObject({ origins: [expect.objectContaining({ localStorage: expect.arrayContaining([{ name: 'OcOpenApi.admin-url', value: 'preserve-admin-schema' }]) })] });
  await login(page, 'kfmb-kw-standard');
  await page.getByRole('link', { name: 'Link to cart' }).click();
  await expect(page.getByText('Kuwait demo pickup point', { exact: true })).toBeVisible();
  await expect(page.getByText('KW flour', { exact: true })).toBeVisible();
  await page.getByLabel('Shopping country').selectOption('sa');
  await expect(page.getByRole('heading', { name: /Login Required/ })).toBeVisible();
  await login(page, 'kfmb-sa-standard');
  await page.getByRole('link', { name: 'Link to cart' }).click();
  await expect(page.getByText('SA flour', { exact: true })).toBeVisible();
  expect(JSON.stringify(mock.orders.get('sa:kfmb-sa-standard'))).toBe(saOrderBefore);
  expect(mock.errors).toEqual([]);
});

test('legacy Saudi entry, bad login, mismatched shopper, and cross-country catalog links', async ({ page, context }) => {
  const mock = await mockShopper(context);
  await page.goto('/cart');
  await expect(page).toHaveURL(/\/sa\/cart$/);
  await login(page, 'bad-password');
  await expect(page.getByText('Invalid login', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Shopping country')).toBeEnabled();
  await login(page, 'wrong-client');
  await expect(page.getByText(/session does not match/)).toBeVisible();
  await login(page, 'wrong-buyer');
  await expect(page.getByRole('heading', { name: /Login Required/ })).toBeVisible();
  await expect(page.getByText('Shopper session could not be verified', { exact: true })).toBeVisible();
  await login(page, 'kfmb-sa-standard');
  await expect(page.getByRole('heading', { name: 'Cart is empty' })).toBeVisible();
  await page.goto('/sa/shop/kw-catalog/products');
  await expect(page.getByText(/This catalog does not belong/)).toBeVisible();
  expect(mock.requests.some((request) => request.path === '/v1/me/products')).toBe(false);
  // A later login may return the identical JWT; the shopper gate must still revalidate the buyer.
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  mock.invalidBuyers.add('kfmb-sa-standard');
  const beforeInvalidLogin = mock.requests.length;
  await login(page, 'kfmb-sa-standard');
  await expect(page.getByRole('heading', { name: /Login Required/ })).toBeVisible();
  expect(mock.requests.slice(beforeInvalidLogin).filter((request) => request.path.startsWith('/v1/cart/') || request.path === '/v1/me/catalogs')).toEqual([]);
  expect(mock.errors).toEqual([]);
});

});

test('feature disabled retains the configured single-country client, old URLs, currency and Saudi pickup', async ({ page, context }) => {
  test.skip(process.env.KFMB_COUNTRY_DISABLED !== 'true', 'Run against the disabled build');
  const mock = await mockShopper(context, true);
  await page.goto('/?country=kw');
  await expect(page).toHaveURL(/\/\?country=kw$/);
  await expect(page.getByLabel('Shopping country')).toHaveCount(0);
  await login(page, 'kfmb-sa-standard');
  await expect(page.getByText('Welcome, SA Shopper')).toBeVisible();
  await page.goto('/products/sa-flour');
  await expect(page.getByRole('button', { name: /Add.*cart/i })).toBeEnabled();
  await expect(page.getByRole('spinbutton')).toHaveValue('1');
  await page.getByRole('button', { name: /Add.*cart/i }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText('Saudi Arabia demo pickup point', { exact: true })).toBeVisible();
  await expect(page.getByText(/SAR.*2\.75/).first()).toBeVisible();
  expect(mock.errors).toEqual([]);
});

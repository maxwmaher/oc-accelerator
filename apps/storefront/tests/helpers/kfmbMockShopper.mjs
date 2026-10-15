import publicConfig from '../../src/config/kfmbPublicConfig.json' with { type: 'json' };

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
export const jwt = (country, username, overrides = {}) => `header.${Buffer.from(JSON.stringify({ cid: publicConfig.storefronts[country].clientID, usrtype: 'buyer', usr: username, exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })).toString('base64url')}.signature`;

export async function mockShopper(context, legacy = false, options = {}) {
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
    if (options.imageResponses?.has(url.href)) return route.fulfill({ contentType: 'image/svg+xml', body: options.imageResponses.get(url.href) });
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
    const products = options.products?.(country, username) || [product(country, username)];
    const item = products.find((candidate) => path === `/v1/me/products/${candidate.ID}`.toLowerCase()) || products[0];
    const worksheet = () => current?.Order.IsSubmitted ? { Order: null, LineItems: null, OrderPromotions: null } : current || { Order: null, LineItems: null, OrderPromotions: null };
    if (path === '/v1/me') return reply({ ID: username, Username: username, FirstName: country.toUpperCase(), LastName: 'Shopper', Email: 'mock@example.test', Buyer: { ID: (username === 'wrong-buyer' || invalidBuyers.has(username)) ? 'other-buyers' : config.buyerID }, CompanyID: config.buyerID, ...options.shopper });
    if (path === '/v1/me/catalogs') return reply(list([{ ID: config.catalogID, Name: `${country} catalog` }]));
    if (path === '/v1/me/categories') return reply(list(options.categories?.(country) || []));
    if (path === '/v1/me/products') {
      if (!legacy && url.searchParams.get('catalogId') !== config.catalogID) errors.push('Wrong country catalog filter');
      const search = url.searchParams.get('search')?.toLowerCase();
      return reply(list(options.products && search ? products.filter((candidate) => `${candidate.Name} ${candidate.ID}`.toLowerCase().includes(search)) : products));
    }
    if (path === `/v1/me/products/${item.ID}`) return reply(item);
    if (path === '/v1/cart/worksheet') return reply(worksheet());
    if (path === '/v1/cart/lineitems' && method === 'POST') {
      const data = request.postDataJSON();
      const orderedProduct = products.find((candidate) => candidate.ID === data.ProductID) || item;
      const order = { ID: options.orderID?.(country, username) || `${country}-${username}-order`, Currency: config.currency, IsSubmitted: false, Subtotal: data.Quantity * orderedProduct.PriceSchedule.PriceBreaks[0].Price, PromotionDiscount: 0, ShippingCost: 0, TaxCost: 0, xp: {} };
      order.Total = order.Subtotal;
      const line = { ID: 'line-1', ProductID: orderedProduct.ID, Product: options.products ? orderedProduct : { ID: orderedProduct.ID, Name: orderedProduct.Name }, Quantity: data.Quantity, UnitPrice: orderedProduct.PriceSchedule.PriceBreaks[0].Price, LineSubtotal: order.Subtotal, LineTotal: order.Subtotal };
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
export async function login(page, username) {
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('mock-only-password');
  await page.getByRole('button', { name: 'Login', exact: true }).last().click();
}

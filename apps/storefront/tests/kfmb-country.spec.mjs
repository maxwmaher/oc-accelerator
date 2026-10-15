import { test, expect } from '@playwright/test';
import publicConfig from '../src/config/kfmbPublicConfig.json' with { type: 'json' };
import { mockShopper, login, jwt } from './helpers/kfmbMockShopper.mjs';

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

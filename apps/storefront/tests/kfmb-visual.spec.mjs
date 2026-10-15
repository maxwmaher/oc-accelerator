import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mockShopper, login } from './helpers/kfmbMockShopper.mjs';
import { representativeOptions, representativePrimary } from './helpers/kfmbRepresentativeFixtures.mjs';

// Opt-in review artifacts stay outside the repository. Commerce requests use
// the same isolated mock as the country behavior suite, never live accounts.
test.describe('KFMB visual review', () => {
  test.skip(process.env.KFMB_VISUAL_AUDIT !== 'true', 'Opt in to screenshot review');

  for (const country of ['kw', 'sa']) {
    for (const width of [1440, 768, 390]) {
      test(`${country} ${width}px ordering journey`, async ({ page, context }) => {
        test.setTimeout(90000);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
        const representative = process.env.KFMB_REPRESENTATIVE_AUDIT === 'true';
        const mock = await mockShopper(context, false, representative ? representativeOptions() : {});
        const errors = [];
        const metrics = [];
        const folder = resolve(process.env.KFMB_REVIEW_DIR || '../../../work/kfmb-review/current');
        await mkdir(folder, { recursive: true });
        page.on('pageerror', (error) => errors.push(error.message));

        const capture = async (scene) => {
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(() => {
            for (const element of [document.documentElement, document.body, document.getElementById('root'), ...document.querySelectorAll('.chakra-modal__content-container')]) element?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          });
          await page.screenshot({ path: resolve(folder, `${country}-${width}-${scene}.png`), fullPage: true, animations: 'disabled' });
          metrics.push({ ...await page.evaluate((name) => ({
            scene: name,
            viewport: window.innerWidth,
            scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            htmlScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            dialogs: [...document.querySelectorAll('[role="dialog"], .chakra-modal__content-container')].map((element) => ({ width: Math.round(element.getBoundingClientRect().width), scrollWidth: element.scrollWidth })),
            buttons: [...document.querySelectorAll('button')].filter((element) => element.getBoundingClientRect().width > 0).map((element) => ({ text: element.textContent?.trim(), background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color, borderRadius: getComputedStyle(element).borderRadius, width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height), disabled: element.disabled })),
            images: [...document.querySelectorAll('img')].filter((element) => element.getBoundingClientRect().width > 0).map((element) => ({ alt: element.alt, fit: getComputedStyle(element).objectFit, width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height), naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight })),
            overflow: [...document.querySelectorAll('body *')]
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1);
              })
              .slice(0, 12)
              .map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 90), width: Math.round(element.getBoundingClientRect().width) })),
          }), scene), requests: mock.requests.map(({ method, url }) => ({ method, path: `${new URL(url).pathname}${new URL(url).search}` })) });
        };

        await page.goto(`/?country=${country}`);
        await expect(page.getByLabel('Shopping country')).toHaveValue(country);
        await capture('login');
        await login(page, 'bad-password');
        await expect(page.getByText('Invalid login', { exact: true })).toBeVisible();
        await capture('login-error');
        await login(page, `kfmb-${country}-wholesale-review`);
        await expect(page.getByRole('link', { name: 'Shop All Products' })).toBeVisible();
        await capture('home');

        await page.goto(`/${country}/cart`);
        await expect(page.getByRole('heading', { name: 'Cart is empty' })).toBeVisible();
        await capture('empty-cart');
        if (representative) {
          await page.goto(`/${country}/shop/${country}-catalog/categories`);
          await expect(page.getByRole('heading', { name: 'Browse categories' })).toBeVisible();
          await capture('categories');
        }
        await page.goto(`/${country}/shop/${country}-catalog/products`);
        const product = representative ? page.getByRole('link').filter({ has: page.getByRole('heading', { name: representativePrimary(country).name, exact: true }) }) : page.getByRole('link', { name: new RegExp(`${country.toUpperCase()} flour`) });
        await expect(product).toBeVisible();
        await capture('listing');
        if (representative) {
          if (width < 1024) {
            await page.getByRole('button', { name: 'Open Filters' }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await capture('filters');
          }
          await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('no-matching-review-product');
          await expect(page).toHaveURL(/search=no-matching-review-product/);
          if (width < 1024) await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
          await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();
          await capture('empty-listing');
          if (width < 1024) await page.getByRole('button', { name: 'Open Filters' }).click();
          await page.getByRole('button', { name: 'Clear product search' }).click();
          if (width < 1024) await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
          await expect(product).toBeVisible();
        }
        await product.click();
        const add = page.getByRole('button', { name: /Add.*cart/i });
        await expect(add).toBeEnabled();
        await expect(page.getByRole('spinbutton')).toHaveValue('5');
        if (process.env.KFMB_ASSERT_LAYOUT === 'true') {
          expect(await add.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(20, 45, 59)');
        }
        if (representative) {
          const image = page.getByRole('img', { name: representativePrimary(country).name, exact: true }).first();
          await expect(image).toBeVisible();
          expect(await image.evaluate((element) => getComputedStyle(element).objectFit)).toBe('contain');
        }
        await capture('product');
        await add.click();
        await expect(page.getByRole('button', { name: 'Save pickup details and review' })).toBeVisible();
        await capture('cart');
        await page.getByRole('button', { name: 'Save pickup details and review' }).click();
        await expect(page.getByRole('heading', { name: 'Payment and review' })).toBeVisible();
        await capture('review');
        await page.getByRole('button', { name: 'Approve and submit order' }).click();
        await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
        await expect(page.getByText(/5 (?:bags|packs|units) added to cart/, { exact: true })).toBeHidden();
        await capture('confirmation');

        await writeFile(resolve(folder, `${country}-${width}-metrics.json`), JSON.stringify({ country, width, representative, metrics, mockErrors: mock.errors, pageErrors: errors }, null, 2));
        expect(mock.errors).toEqual([]);
        expect(errors).toEqual([]);
        if (process.env.KFMB_ASSERT_LAYOUT === 'true') {
          expect(metrics.filter((metric) => metric.scrollWidth > metric.viewport + 1), 'Scenes with horizontal page overflow').toEqual([]);
        }
      });
    }
  }
});

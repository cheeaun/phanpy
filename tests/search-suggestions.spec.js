// @ts-check
import { expect, test } from '@playwright/test';

test.setTimeout(120000);

test('search suggestion stays clickable while the pointer is held down', async ({
  page,
}) => {
  await page.goto('/#/search');
  await page.waitForSelector('input[name="q"]', { timeout: 60000 });

  const input = page.locator('input[name="q"]:visible').first();
  await input.click();
  await input.fill('hello');

  const popover = page.locator('.search-popover').first();
  const suggestion = page
    .locator('.search-popover:not([hidden]) .search-popover-item')
    .first();
  await expect(suggestion).toBeVisible();

  const box = await suggestion.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  // The popover must survive the press. It used to hide 100ms after the input
  // blurred, so a slower click released over a hidden element and did nothing.
  await page.waitForTimeout(300);
  await expect(popover).not.toHaveAttribute('hidden', /.*/);

  await page.mouse.up();
  await expect(page).toHaveURL(/q=hello/);
});

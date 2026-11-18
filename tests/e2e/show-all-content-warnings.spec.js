// @ts-check
import {
  createStatus,
  expect,
  openStatus,
  setupApp,
  test,
} from './fixtures.js';

const HERO_ID = '100';
const THRESHOLD = 3;
const BAR = '.status-deck .floating-bar';
const BUTTON = `${BAR} button`;

/** Hero post plus `count` CW replies in the same thread. @param {number} count */
function threadWithWarnings(count) {
  const descendants = Array.from({ length: count }, (_, i) =>
    createStatus({
      id: String(101 + i),
      spoilerText: `cw ${i + 1}`,
      replyToId: HERO_ID,
    }),
  );
  return {
    hero: createStatus({ id: HERO_ID, spoilerText: 'cw hero' }),
    context: { ancestors: [], descendants },
  };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} count
 */
async function openThreadWithWarnings(page, count) {
  const { hero, context } = threadWithWarnings(count);
  await setupApp(page, {
    [`v1/statuses/${HERO_ID}`]: hero,
    [`v1/statuses/${HERO_ID}/context`]: context,
  });
  await openStatus(page, HERO_ID);
  await expect(page.locator('.status-deck .hero')).toBeVisible({
    timeout: 15000,
  });
  // Hero CW auto-expands after 1s
  await expect(
    page.locator('.status-deck .hero .content-container.show-spoiler'),
  ).toBeVisible({ timeout: 15000 });
}

/** Hidden warnings, counted per post. @param {import('@playwright/test').Page} page */
function hiddenCount(page) {
  return page.evaluate(() => {
    const ids = new Set();
    for (const el of document.querySelectorAll(
      '.status-deck .content-container:not(.show-spoiler) .spoiler-button:not(.spoiling)',
    )) {
      const post = el.closest('[data-state-post-id]');
      ids.add(post?.dataset.statePostId ?? Math.random());
    }
    return ids.size;
  });
}

/**
 * Programmatic scroll is smooth, so wait for it to settle.
 * @param {import('@playwright/test').Page} page
 * @param {'top' | 'bottom'} position
 */
async function scrollDeck(page, position) {
  await page.evaluate((to) => {
    const el = document.querySelector('.status-deck');
    if (el) el.scrollTop = to === 'top' ? 0 : el.scrollHeight;
  }, position);
  await page.waitForFunction(
    (to) => {
      const el = document.querySelector('.status-deck');
      if (!el) return false;
      return to === 'top'
        ? el.scrollTop === 0
        : el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    },
    position,
    { timeout: 5000 },
  );
}

test.describe('Show all content warnings', () => {
  test('bar stays hidden at or below the threshold', async ({ page }) => {
    await openThreadWithWarnings(page, THRESHOLD);

    expect(await hiddenCount(page)).toBe(THRESHOLD);
    await expect(page.locator(BAR)).toBeHidden();
    await expect(page.locator(BUTTON)).toBeHidden();
  });

  test('reveals every warning and dismisses itself', async ({ page }) => {
    await openThreadWithWarnings(page, THRESHOLD + 2);

    await expect(page.locator(BUTTON)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(BUTTON)).toHaveText(/Show all content warnings/i);
    await expect(page.locator(BAR)).toBeVisible();

    await page.locator(BUTTON).click();

    await expect.poll(() => hiddenCount(page)).toBe(0);
    await expect(page.locator(BAR)).toBeHidden();
  });

  test('follows warnings revealed by hand', async ({ page }) => {
    await openThreadWithWarnings(page, THRESHOLD + 2);
    await expect(page.locator(BUTTON)).toBeVisible({ timeout: 15000 });

    const reveal = '.status-deck .spoiler-button:not(.spoiling)';

    await page.locator(reveal).last().click();
    await expect.poll(() => hiddenCount(page)).toBe(THRESHOLD + 1);
    await expect(page.locator(BUTTON)).toBeVisible();

    await page.locator(reveal).first().click();
    await expect.poll(() => hiddenCount(page)).toBe(THRESHOLD);
    await expect(page.locator(BAR)).toBeHidden();
  });

  test('docked at the bottom, also while scrolling', async ({ page }) => {
    await openThreadWithWarnings(page, THRESHOLD + 4);
    await expect(page.locator(BUTTON)).toBeVisible({ timeout: 15000 });

    for (const position of ['top', 'bottom']) {
      await scrollDeck(page, position);
      // Entrance springs past its resting position
      await page.waitForFunction(() =>
        document
          .querySelector('.status-deck .floating-bar')
          ?.getAnimations()
          .every((a) => a.playState !== 'running'),
      );

      const deck = await page.evaluate(() => {
        const el = document.querySelector('.status-deck');
        if (!el) throw new Error('Status deck is missing');
        return el.getBoundingClientRect().toJSON();
      });
      const bar = await page.locator(BAR).boundingBox();
      if (!bar) throw new Error(`Bar missing at ${position}`);

      // Flush with the deck's bottom edge, above the safe-area inset
      expect(
        Math.abs(bar.y + bar.height - (deck.top + deck.height)),
        `bar bottom at ${position}`,
      ).toBeLessThanOrEqual(1);
      // Centered on the deck
      expect(
        Math.abs(bar.x + bar.width / 2 - (deck.x + deck.width / 2)),
      ).toBeLessThanOrEqual(1);
      expect(bar.y, `bar top at ${position}`).toBeGreaterThanOrEqual(0);
      expect(
        bar.y + bar.height,
        `bar bottom at ${position}`,
      ).toBeLessThanOrEqual(deck.top + deck.height + 0.5);
    }
  });

  test('menu item reveals the same set of warnings', async ({ page }) => {
    await openThreadWithWarnings(page, THRESHOLD + 2);
    await expect(page.locator(BUTTON)).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'More' }).first().click();
    await page
      .getByRole('menuitem', { name: /Show all content warnings/i })
      .click();

    await expect.poll(() => hiddenCount(page)).toBe(0);
    await expect(page.locator(BAR)).toBeHidden();
  });
});

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { test, expect } from '@playwright/test';

const graphemeInputSource = readFileSync(
  resolve(import.meta.dirname, '../src/components/grapheme-input.js'),
  'utf-8',
);

test.describe('GraphemeInput Web Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.addScriptTag({ content: graphemeInputSource });
    await page.waitForFunction(() => customElements.get('grapheme-input'));
  });

  test('should move maxlength to wrapper element', async ({ page }) => {
    await page.setContent(`
      <grapheme-input>
        <input type="text" maxlength="10" />
      </grapheme-input>
    `);

    const input = page.locator('input');
    const wrapper = page.locator('grapheme-input');

    // Wrapper should have maxlength
    await expect(wrapper).toHaveAttribute('maxlength', '10');

    // Input should not have maxlength
    await expect(input).not.toHaveAttribute('maxlength');
  });

  test('should treat multi-code-point grapheme as 1 character', async ({
    page,
  }) => {
    // 👨‍👩‍👧 is 1 grapheme but 5 code points (3 emoji joined by 2 ZWJ characters).
    // With maxlength="1", grapheme mode should keep it intact.
    await page.setContent(`
      <grapheme-input>
        <input type="text" maxlength="1" />
      </grapheme-input>
    `);

    const input = page.locator('input');
    await input.fill('👨‍👩‍👧');
    await expect(input).toHaveValue('👨‍👩‍👧');
  });

  test('should work with textarea', async ({ page }) => {
    await page.setContent(`
      <grapheme-input>
        <textarea maxlength="3"></textarea>
      </grapheme-input>
    `);

    const textarea = page.locator('textarea');
    await textarea.click();

    // Type 5 graphemes
    await textarea.fill('aé🎉bc');

    // Should be truncated to 3
    await expect(textarea).toHaveValue('aé🎉');
  });

  test('should handle no maxlength attribute', async ({ page }) => {
    await page.setContent(`
      <grapheme-input>
        <input type="text" />
      </grapheme-input>
    `);

    const input = page.locator('input');
    const wrapper = page.locator('grapheme-input');

    // No maxlength attributes should be set
    await expect(input).not.toHaveAttribute('maxlength');
    await expect(wrapper).not.toHaveAttribute('maxlength');

    // Should allow unlimited input
    await input.fill('unlimited text');
    await expect(input).toHaveValue('unlimited text');
  });

  test('should handle paste events', async ({ page }) => {
    await page.setContent(`
      <grapheme-input>
        <input type="text" maxlength="2" />
      </grapheme-input>
    `);

    const input = page.locator('input');

    // Simulate paste by setting value directly and dispatching input event
    // (paste triggers input in real browsers, so we test the input handler)
    await page.evaluate(() => {
      const input = document.querySelector('input');
      input.value = 'aé🎉b'; // 4 graphemes
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Should be truncated to 2 graphemes
    await expect(input).toHaveValue('aé');
  });
});

test.describe('GraphemeInput Web Component (Intl.Segmenter unavailable)', () => {
  test.beforeEach(async ({ page }) => {
    // Delete Intl.Segmenter before any script runs on the page, so the
    // module-level `segmenter` constant in grapheme-input.js evaluates to null.
    await page.addInitScript(() => {
      delete Intl.Segmenter;
    });
    await page.goto('about:blank');
    await page.addScriptTag({ content: graphemeInputSource });
    await page.waitForFunction(() => customElements.get('grapheme-input'));
  });

  test('should apply code point limiting when Intl.Segmenter is unavailable', async ({
    page,
  }) => {
    // Confirm the setup actually removed Intl.Segmenter
    const hasSegmenter = await page.evaluate(
      () => typeof Intl.Segmenter === 'function',
    );
    expect(hasSegmenter).toBe(false);

    // 👨‍👩‍👧 is 1 grapheme but 5 code points (3 emoji joined by 2 ZWJ characters).
    // With maxlength="1", grapheme mode would keep it intact, but code point
    // mode truncates to 1 code point, leaving just 👨.
    await page.setContent(`
      <grapheme-input>
        <input type="text" maxlength="1" />
      </grapheme-input>
    `);

    const input = page.locator('input');
    const wrapper = page.locator('grapheme-input');

    // maxlength should be moved to wrapper
    await expect(wrapper).toHaveAttribute('maxlength', '1');
    await expect(input).not.toHaveAttribute('maxlength');

    // Should be truncated to 1 code point, not 1 grapheme
    await input.fill('👨‍👩‍👧');
    await expect(input).toHaveValue('👨');
  });
});

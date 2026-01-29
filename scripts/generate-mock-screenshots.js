import path from 'path';
import { fileURLToPath } from 'url';

import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
];

const COLOR_SCHEMES = ['light', 'dark'];

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '../mock-screenshots');

async function generateScreenshots() {
  const browser = await chromium.launch();

  try {
    for (const colorScheme of COLOR_SCHEMES) {
      for (const viewport of VIEWPORTS) {
        console.log(
          `Generating ${viewport.name} ${colorScheme} screenshot (${viewport.width}x${viewport.height})...`,
        );

        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 2,
          colorScheme,
        });

        const page = await context.newPage();

        // Listen to console messages
        page.on('console', (msg) => {
          const type = msg.type();
          if (type === 'error' || type === 'warning') {
            console.log(` [Browser ${type}]:`, msg.text());
          }
        });

        // Listen to page errors
        page.on('pageerror', (error) => {
          console.error('  [Browser error]:', error.message);
        });

        // Navigate to the mock home page
        const url = `${BASE_URL}/#/_mock/home`;
        console.log(`  Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });

        // Wait for React app to mount
        await page.waitForSelector('#app', { timeout: 10000 });
        console.log('  ✓ App mounted');

        // Wait for React to hydrate and route to render
        await page.waitForTimeout(3000);

        // Wait for the timeline to be rendered
        try {
          await page.waitForSelector('.timeline', { timeout: 30000 });
          console.log('  ✓ Timeline found');
        } catch (e) {
          console.error('  ✗ Timeline not found.');
          console.error('  Current URL:', page.url());
          const bodyHTML = await page.evaluate(() => document.body.innerHTML);
          console.error('  Body HTML:', bodyHTML.substring(0, 1000));
          const errors = await page.evaluate(() => {
            return window.__errors || [];
          });
          console.error('  JS Errors:', errors);
          throw e;
        }

        // Wait for timeline items to be rendered
        try {
          await page.waitForSelector('.timeline-item', { timeout: 30000 });
          console.log('  ✓ Timeline items found');
        } catch (e) {
          console.error('  ✗ Timeline items not found');
          throw e;
        }

        // Wait for images and fonts to load
        await page.waitForTimeout(3000);

        const screenshotPath = path.join(
          OUTPUT_DIR,
          `mock-home-${viewport.name}-${colorScheme}@2x.png`,
        );
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });

        console.log(`  ✓ Screenshot saved: ${screenshotPath}`);
        await context.close();
      }
    }

    await browser.close();
    console.log('\n✨ All screenshots generated successfully!');
    console.log(
      'Generated 4 screenshots: mobile & desktop in both light & dark modes',
    );
  } catch (error) {
    await browser.close();
    throw error;
  }
}

generateScreenshots().catch((error) => {
  console.error('Error generating screenshots:', error);
  process.exit(1);
});

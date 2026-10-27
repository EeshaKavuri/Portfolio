import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const [url = 'https://huyml.co/', name = 'reference'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await page.screenshot({ path: `artifacts/${name}-desktop.png` });
  await page.mouse.wheel(0, 950);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `artifacts/${name}-work.png` });
  console.log('Reference screenshots saved in artifacts.');
} finally {
  await browser.close();
}

import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:5183/test-coding-chess-advanced-2/analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
// Find the textarea
const ta = await page.locator('textarea').count();
console.log('textarea count:', ta);
const taTestid = await page.locator('textarea').first().getAttribute('data-testid').catch(()=>null);
console.log('textarea testid:', taTestid);
await page.screenshot({ path: '.pi/acceptance/quick-analyze.png' });
await browser.close();

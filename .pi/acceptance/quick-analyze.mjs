import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Check what's actually on the page
const info = await page.evaluate(() => {
  const textareas = document.querySelectorAll('textarea');
  const buttons = document.querySelectorAll('button');
  return {
    textareaCount: textareas.length,
    textareaIds: [...textareas].map(t => ({ id: t.id, testid: t.dataset.testid, placeholder: t.placeholder, className: t.className.slice(0,50) })),
    buttonTexts: [...buttons].map(b => b.textContent?.trim()).slice(0, 10),
    bodyText: document.body.innerText.slice(0, 300),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
